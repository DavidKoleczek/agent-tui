#!/usr/bin/env bash
# Installer for agent-tui. Downloads the latest released binary, verifies its sha256, and places it as `floppy` on PATH.
#
#   curl -fsSL https://github.com/DavidKoleczek/agent-tui/releases/latest/download/install.sh | bash

set -euo pipefail

MANIFEST_URL="https://github.com/DavidKoleczek/agent-tui/releases/latest/download/latest.json"
INSTALL_DIR="${HOME}/.local/bin"
BIN_NAME="floppy"

err() {
    printf 'install: %s\n' "$1" >&2
    exit 1
}

arch="$(uname -m)"
case "${arch}" in
    x86_64 | amd64) ;;
    *) err "unsupported architecture: ${arch}" ;;
esac

for tool in curl; do
    command -v "${tool}" >/dev/null 2>&1 || err "required tool not found: ${tool}"
done

manifest="$(curl -fsSL "${MANIFEST_URL}")" || err "failed to fetch release manifest from ${MANIFEST_URL}"

# Pull the linux-x64 url and sha256 out of the manifest
json_field() {
    printf '%s' "$1" | grep -o "\"$2\": *\"[^\"]*\"" | head -n1 | sed 's/.*: *"\(.*\)"/\1/'
}

block="$(printf '%s' "${manifest}" | sed -n '/"linux-x64"/,/}/p')"
url="$(json_field "${block}" url)"
sha="$(json_field "${block}" sha256)"

[ -n "${url}" ] || err "could not determine the download url from the manifest"
[ -n "${sha}" ] || err "could not determine the expected sha256 from the manifest"

tmp="$(mktemp)"
trap 'rm -f "${tmp}"' EXIT

printf 'Downloading floppy from %s\n' "${url}"
curl -fsSL "${url}" -o "${tmp}" || err "download failed"

if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "${tmp}" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "${tmp}" | awk '{print $1}')"
else
    err "no sha256 tool found (need sha256sum or shasum)"
fi

# Case-insensitive compare; some tools emit uppercase hex.
if [ "$(printf '%s' "${actual}" | tr 'A-Z' 'a-z')" != "$(printf '%s' "${sha}" | tr 'A-Z' 'a-z')" ]; then
    err "checksum mismatch (expected ${sha}, got ${actual})"
fi

mkdir -p "${INSTALL_DIR}"
mv "${tmp}" "${INSTALL_DIR}/${BIN_NAME}"
trap - EXIT
chmod +x "${INSTALL_DIR}/${BIN_NAME}"

printf 'Installed floppy to %s/%s\n' "${INSTALL_DIR}" "${BIN_NAME}"

# Ensure the install dir is on PATH. Append to the shell profile only when it is missing.
case ":${PATH}:" in
    *":${INSTALL_DIR}:"*)
        printf 'Run `floppy` to start.\n'
        ;;
    *)
        case "${SHELL:-}" in
            */zsh) profile="${HOME}/.zshrc" ;;
            */bash) profile="${HOME}/.bashrc" ;;
            *) profile="${HOME}/.profile" ;;
        esac
        line="export PATH=\"${INSTALL_DIR}:\$PATH\""
        if [ ! -f "${profile}" ] || ! grep -qF "${INSTALL_DIR}" "${profile}"; then
            printf '\n%s\n' "${line}" >>"${profile}"
            printf 'Added %s to PATH in %s\n' "${INSTALL_DIR}" "${profile}"
        fi
        printf 'Open a new terminal (or `source %s`), then run `floppy`.\n' "${profile}"
        ;;
esac
