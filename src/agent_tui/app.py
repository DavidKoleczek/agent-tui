import os
from pathlib import Path
import time
from typing import ClassVar, cast

from agent_core._types import (
    AgentConfig,
    AgentEvent,
    AgentMessageEvent,
    AgentReasoningEvent,
    AgentToolCallEvent,
    AgentToolOutputEvent,
    AgentTurnEnd,
    SubagentConfig,
    TurnConfig,
    UserMessageEvent,
    UserToolCallPermissionEvent,
)
from agent_core.agent import Agent
from agent_core.tools.presets import standard_tools
from anthropic import AsyncAnthropic
from google import genai
from interop_router.router import Router
from interop_router.types import SupportedModel
from openai import AsyncOpenAI
from textual import work
from textual.app import App, ComposeResult
from textual.binding import Binding, BindingType
from textual.message import Message
from textual.widgets import RichLog

from agent_tui.tui.agent_timer import AgentTimer
from agent_tui.tui.css import AGENT_APP_CSS
from agent_tui.tui.formatters import BulletMarkdown, format_user_message
from agent_tui.tui.input_text_area import InputTextArea
from agent_tui.tui.status_line import MODE_COLORS, StatusLine
from agent_tui.tui.tool_approval_screen import ToolApprovalResult, ToolApprovalScreen, ToolDecision
from agent_tui.tui.tool_display._registry import get_formatter
from agent_tui.tui.tool_display._widget import ToolCallDisplay, ToolOutputDisplay

DOUBLE_TAP_SECONDS = 0.25
MODES = list(MODE_COLORS.keys())


class AgentEventReceived(Message):
    """Posted when an AgentEvent is received from the agent."""

    def __init__(self, event: AgentEvent) -> None:
        self.event = event
        super().__init__()


class AgentApp(App):
    CSS = AGENT_APP_CSS

    # ctrl+a overrides TextArea's default binding which lets us highlight all text.
    BINDINGS: ClassVar[list[BindingType]] = [
        Binding("ctrl+c", "interrupt", "Interrupt", show=False, priority=True),
        Binding("ctrl+a", "select_all", "Select All", show=False, priority=True),
        Binding("shift+tab", "cycle_mode", "Cycle Mode", show=False, priority=True),
    ]

    def __init__(self) -> None:
        super().__init__()
        self._last_ctrl_c: float = 0.0
        self._mode_index: int = 0
        self._is_processing: bool = False
        self._processing_permissions: bool = False
        self._pending_tool_calls: dict[str, AgentToolCallEvent] = {}

        self._router = Router()
        self._router.register("openai", AsyncOpenAI())
        self._router.register("gemini", genai.Client(api_key=os.getenv("GEMINI_API_KEY")))
        self._router.register("anthropic", AsyncAnthropic())
        working_dir = Path.cwd()
        self._agent_config = AgentConfig(working_dir=working_dir)
        self._agent = Agent(self._agent_config, self._router)

        tools = standard_tools(working_dir=working_dir)

        # Base config for subagents (without nested subagents)
        base_turn_config = TurnConfig(
            model=cast(SupportedModel, "gpt-5.1-codex-max"),
            model_friendly_name="gpt-5.1-codex-max",
            model_knowledge_cutoff="Sep 30, 2024",
            timezone="America/New_York",
            tools=tools,
            subagents=[],
        )

        self._turn_config = TurnConfig(
            model=cast(SupportedModel, "gpt-5.1-codex-max"),
            model_friendly_name="gpt-5.1-codex-max",
            model_knowledge_cutoff="Sep 30, 2024",
            timezone="America/New_York",
            tools=tools,
            subagents=[
                SubagentConfig(
                    name="general-purpose",
                    description="General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks.",
                    turn_config=base_turn_config,
                ),
            ],
        )

    def on_input_text_area_submitted(self, event: InputTextArea.Submitted) -> None:
        value = event.value.strip()
        if not value or self._is_processing:
            return

        self.query_one(AgentTimer).start()

        # Display user message
        log = self.query_one("#event-log", RichLog)
        log.write(format_user_message(value))
        self.query_one(InputTextArea).clear()

        # Start agent turn
        self._is_processing = True
        self._run_agent_turn(UserMessageEvent(message=value))

    @work(exclusive=True)
    async def _run_agent_turn(self, user_event: UserMessageEvent) -> None:
        """Run an agent turn in a background worker."""
        async for event in self._agent.turn(user_event, self._turn_config):
            self.post_message(AgentEventReceived(event))

    def on_agent_event_received(self, message: AgentEventReceived) -> None:
        """Handle events received from the agent.
        Textual maps AgentEventReceived to this method automatically.
        """
        event = message.event
        log = self.query_one("#event-log", RichLog)

        if isinstance(event, AgentMessageEvent):
            log.write(BulletMarkdown(event.message, agent_name=event.agent_name))
        elif isinstance(event, AgentReasoningEvent):
            log.write(BulletMarkdown(event.message, dim=True, show_bullet=False, agent_name=event.agent_name))
        elif isinstance(event, AgentToolCallEvent):
            self._handle_tool_call(event, log)
        elif isinstance(event, AgentToolOutputEvent):
            self._handle_tool_output(event, log)
        elif isinstance(event, AgentTurnEnd):
            self._is_processing = False
            self.query_one(AgentTimer).stop()
            if event.reason == "tools_need_decision" and not self._processing_permissions:
                self._show_tool_approval_modal()

    def action_interrupt(self) -> None:
        """Handle Ctrl+C with context-dependent behavior.

        - If text is selected: copy to clipboard
        - If processing: cancel worker and hide timer
        - Single tap: clear input
        - Double tap: exit app
        """
        text_area = self.query_one(InputTextArea)
        if not text_area.selection.is_empty:
            text_area.action_copy()
            return

        if self._is_processing:
            self.workers.cancel_all()
            self._is_processing = False
            self.query_one(AgentTimer).hide()
            log = self.query_one("#event-log", RichLog)
            log.write("[red]Interrupted[/red]")
            return

        now = time.monotonic()
        if now - self._last_ctrl_c < DOUBLE_TAP_SECONDS:
            self.exit()
        else:
            self._last_ctrl_c = now
            text_area.clear()

    def action_select_all(self) -> None:
        self.query_one(InputTextArea).action_select_all()

    def action_cycle_mode(self) -> None:
        """Cycle through available modes."""
        self._mode_index = (self._mode_index + 1) % len(MODES)
        self.query_one(StatusLine).set_mode(MODES[self._mode_index])

    def _handle_tool_call(self, event: AgentToolCallEvent, log: RichLog) -> None:
        self._pending_tool_calls[event.call_id] = event
        formatter = get_formatter(event.name)
        header = formatter.format_call_header(event)

        # Don't display todo calls since they don't need approval and will immediately execute
        if event.name != "todo_write":
            log.write(ToolCallDisplay(header, pending=event.needs_approval, agent_name=event.agent_name))

    def _handle_tool_output(self, event: AgentToolOutputEvent, log: RichLog) -> None:
        call_event = self._pending_tool_calls.pop(event.call_id, None)
        formatter = get_formatter(event.name)
        header = formatter.format_call_header(call_event) if call_event else event.name
        summary = formatter.format_output_summary(event)
        details = formatter.format_output_details(event)
        log.write(ToolOutputDisplay(header, summary, details, agent_name=event.agent_name))

    def compose(self) -> ComposeResult:
        """The layout of the app is:
        - Message log
        - A line showing how long the agent has been processing or how long it took
        - Area for the user to input text
        - Status line at the bottom showing mode, model, and tokens.
        """
        yield RichLog(id="event-log", wrap=True, markup=True)
        yield AgentTimer()
        yield InputTextArea(id="input")
        yield StatusLine()

    def on_mount(self) -> None:
        self.query_one(RichLog).can_focus = False
        self.query_one(StatusLine).can_focus = False
        self.query_one(AgentTimer).can_focus = False
        self.query_one(InputTextArea).focus()

    def _show_tool_approval_modal(self) -> None:
        pending = {call_id: event for call_id, event in self._pending_tool_calls.items() if event.needs_approval}
        if not pending:
            return
        self.push_screen(ToolApprovalScreen(pending), self._handle_tool_approval_result)

    def _handle_tool_approval_result(self, result: ToolApprovalResult | None) -> None:
        """Callback for when the tool approval modal is dismissed.

        Logs each decision, clears the pending tool calls, and starts a worker
        to send the permission events to the agent.
        """
        if result is None:
            return

        log = self.query_one("#event-log", RichLog)
        for call_id, decision in result.decisions.items():
            tool_event = self._pending_tool_calls.get(call_id)
            if tool_event:
                formatter = get_formatter(tool_event.name)
                header = formatter.format_call_header(tool_event)
                status = "[green]Accepted[/green]" if decision == "accept" else "[red]Rejected[/red]"
                log.write(f"  {status}: {header}")

        for call_id in result.decisions:
            self._pending_tool_calls.pop(call_id, None)

        self._processing_permissions = True
        self._is_processing = True
        self.query_one(AgentTimer).start()
        self._run_agent_turn_with_permissions(result.decisions, result.feedback)

    @work(exclusive=True)
    async def _run_agent_turn_with_permissions(self, decisions: dict[str, ToolDecision], feedback: str | None) -> None:
        """Send permission events to the agent for each tool call decision.

        Each permission event is sent sequentially. Only the first event includes
        the user's feedback to avoid duplicate messages in agent history.
        """
        first = True
        for call_id, decision in decisions.items():
            permission_event = UserToolCallPermissionEvent(
                call_id=call_id,
                permission=decision,
                feedback=feedback if first else None,
            )
            first = False

            async for event in self._agent.turn(permission_event, self._turn_config):
                self.post_message(AgentEventReceived(event))

        self._processing_permissions = False


def main() -> None:
    """Run the Agent TUI application."""
    AgentApp().run()


if __name__ == "__main__":
    main()
