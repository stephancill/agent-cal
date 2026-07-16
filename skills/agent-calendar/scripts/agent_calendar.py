#!/usr/bin/env python3
import argparse
import json
import os
import socket
import ssl
import sys
import tempfile
from http.client import HTTPConnection, HTTPSConnection, HTTPResponse
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, urlunparse
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_CREDENTIALS = Path.home() / ".config" / "agent-calendar" / "credentials.json"
RESOLVE = {}


def main():
    parser = argparse.ArgumentParser(description="Agent Calendar API helper")
    parser.add_argument("--credentials", default=os.environ.get("AGENT_CALENDAR_CREDENTIALS"))
    parser.add_argument(
        "--resolve",
        action="append",
        default=parse_resolve_env(os.environ.get("AGENT_CALENDAR_RESOLVE")),
        help="Override DNS as host:ip. May be repeated. Must appear before the subcommand.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    health = sub.add_parser("health")
    add_api_base(health)

    setup = sub.add_parser("setup")
    add_api_base(setup, required=True)
    setup.add_argument("--profile", default="default")
    setup.add_argument("--name", required=True)
    setup.add_argument("--description")
    setup.add_argument("--timezone", default="UTC")
    setup.add_argument("--force", action="store_true")

    sub.add_parser("profiles")

    status = sub.add_parser("status")
    status.add_argument("--profile")
    status.add_argument("--show-secrets", action="store_true")

    subscription = sub.add_parser("subscription-url")
    subscription.add_argument("--profile")

    forget = sub.add_parser("forget")
    forget.add_argument("--profile", required=True)

    list_events = sub.add_parser("list-events")
    add_profile_or_explicit(list_events)

    create_event = sub.add_parser("create-event")
    add_profile_or_explicit(create_event)
    add_event_args(create_event)

    update_event = sub.add_parser("update-event")
    add_profile_or_explicit(update_event)
    update_event.add_argument("--event-id", required=True)
    add_event_args(update_event)

    delete_event = sub.add_parser("delete-event")
    add_profile_or_explicit(delete_event)
    delete_event.add_argument("--event-id", required=True)

    fetch_ics = sub.add_parser("fetch-ics")
    fetch_ics.add_argument("--url")
    fetch_ics.add_argument("--profile")

    args = parser.parse_args()
    credentials_path = Path(args.credentials) if args.credentials else DEFAULT_CREDENTIALS
    global RESOLVE
    RESOLVE = parse_resolve_values(args.resolve or [])

    try:
        run(args, credentials_path)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)


def run(args, credentials_path):
    if args.command == "health":
        print_json(request_json("GET", f"{api_base(args)}/health"))
    elif args.command == "setup":
        cmd_setup(args, credentials_path)
    elif args.command == "profiles":
        cmd_profiles(credentials_path)
    elif args.command == "status":
        cmd_status(args, credentials_path)
    elif args.command == "subscription-url":
        profile = load_profile(credentials_path, args.profile)
        print(profile["webcalUrl"])
    elif args.command == "forget":
        cmd_forget(args, credentials_path)
    elif args.command == "list-events":
        profile = resolve_profile(args, credentials_path)
        print_json(request_json("GET", f"{profile['apiBase']}/v1/calendars/{profile['calendarId']}/events", token=profile["updateToken"]))
    elif args.command == "create-event":
        profile = resolve_profile(args, credentials_path)
        print_json(request_json("POST", f"{profile['apiBase']}/v1/calendars/{profile['calendarId']}/events", event_payload(args), profile["updateToken"]))
    elif args.command == "update-event":
        profile = resolve_profile(args, credentials_path)
        print_json(request_json("PUT", f"{profile['apiBase']}/v1/calendars/{profile['calendarId']}/events/{args.event_id}", event_payload(args), profile["updateToken"]))
    elif args.command == "delete-event":
        profile = resolve_profile(args, credentials_path)
        print_json(request_json("DELETE", f"{profile['apiBase']}/v1/calendars/{profile['calendarId']}/events/{args.event_id}", token=profile["updateToken"]))
    elif args.command == "fetch-ics":
        url = args.url or load_profile(credentials_path, args.profile)["subscribeUrl"]
        sys.stdout.write(request_text("GET", url))


def add_api_base(parser, required=False):
    parser.add_argument("--api-base", default=os.environ.get("AGENT_CALENDAR_API_BASE"), required=required and not os.environ.get("AGENT_CALENDAR_API_BASE"))


def add_profile_or_explicit(parser):
    parser.add_argument("--profile")
    parser.add_argument("--api-base", default=os.environ.get("AGENT_CALENDAR_API_BASE"))
    parser.add_argument("--calendar-id")
    parser.add_argument("--token", default=os.environ.get("AGENT_CALENDAR_TOKEN"))


def add_event_args(parser):
    parser.add_argument("--id")
    parser.add_argument("--title", required=True)
    parser.add_argument("--description")
    parser.add_argument("--location")
    parser.add_argument("--starts-at", required=True)
    parser.add_argument("--ends-at", required=True)
    parser.add_argument("--timezone", default="UTC")
    parser.add_argument("--status", choices=["confirmed", "tentative", "cancelled"], default="confirmed")
    parser.add_argument("--rrule")


def cmd_setup(args, path):
    data = load_credentials(path)
    profiles = data.setdefault("profiles", {})
    existing = profiles.get(args.profile)
    if existing and not args.force:
        try:
            verify_profile(existing)
        except Exception as exc:
            raise RuntimeError(f"Profile {args.profile!r} already exists, but verification failed: {exc}. Run setup with --force to replace it.")
        print_json(redact_profile(existing, f"Existing profile {args.profile!r} is already configured and verified."))
        return

    payload = {"name": args.name, "timezone": args.timezone}
    if args.description:
        payload["description"] = args.description
    response = request_json("POST", f"{api_base(args)}/v1/calendars", payload)
    profile = {
        "apiBase": api_base(args),
        "calendarId": response["calendarId"],
        "updateToken": response["updateToken"],
        "subscribeUrl": url_for_api_base(response["subscribeUrl"], api_base(args)),
        "webcalUrl": webcal_for_api_base(response["subscribeUrl"], api_base(args)),
        "createdAt": now_iso(),
    }
    profiles[args.profile] = profile
    if not data.get("defaultProfile"):
        data["defaultProfile"] = args.profile
    write_credentials(path, data)
    print_json(redact_profile(profile, "Calendar configured. Share the webcalUrl with the user; keep updateToken secret."))


def cmd_profiles(path):
    data = load_credentials(path)
    print_json({"defaultProfile": data.get("defaultProfile"), "profiles": sorted(data.get("profiles", {}).keys())})


def cmd_status(args, path):
    profile = load_profile(path, args.profile)
    verified = False
    error = None
    try:
        verify_profile(profile)
        verified = True
    except Exception as exc:
        error = str(exc)
    output = dict(profile if args.show_secrets else redact_profile(profile))
    output["verified"] = verified
    if error:
        output["error"] = error
    print_json(output)


def cmd_forget(args, path):
    data = load_credentials(path)
    profiles = data.setdefault("profiles", {})
    if args.profile not in profiles:
        raise RuntimeError(f"Profile {args.profile!r} does not exist")
    del profiles[args.profile]
    if data.get("defaultProfile") == args.profile:
        data["defaultProfile"] = sorted(profiles.keys())[0] if profiles else None
    write_credentials(path, data)
    print_json({"ok": True})


def resolve_profile(args, path):
    if args.api_base and args.calendar_id and args.token:
        return {"apiBase": normalize_api_base(args.api_base), "calendarId": args.calendar_id, "updateToken": args.token}
    return load_profile(path, args.profile)


def load_profile(path, profile_name):
    data = load_credentials(path)
    name = profile_name or data.get("defaultProfile")
    if not name:
        raise RuntimeError("No profile specified and no default profile configured")
    profile = data.get("profiles", {}).get(name)
    if not profile:
        raise RuntimeError(f"Profile {name!r} does not exist")
    return profile


def verify_profile(profile):
    return request_json("GET", f"{profile['apiBase']}/v1/calendars/{profile['calendarId']}", token=profile["updateToken"])


def load_credentials(path):
    if not path.exists():
        return {"defaultProfile": None, "profiles": {}}
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    data.setdefault("profiles", {})
    return data


def write_credentials(path, data):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix="credentials.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, sort_keys=True)
            f.write("\n")
        os.chmod(tmp_name, 0o600)
        os.replace(tmp_name, path)
    finally:
        if os.path.exists(tmp_name):
            os.unlink(tmp_name)


def request_json(method, url, payload=None, token=None):
    text = request_text(method, url, payload, token)
    return json.loads(text) if text else {}


def request_text(method, url, payload=None, token=None):
    headers = {"Accept": "application/json", "User-Agent": "agent-calendar-cli/0.1"}
    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        parsed = urlparse(url)
        if parsed.hostname in RESOLVE:
            return request_text_with_resolve(method, parsed, body, headers, RESOLVE[parsed.hostname])
        with urlopen(Request(url, data=body, headers=headers, method=method), timeout=30) as response:
            return response.read().decode("utf-8")
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} {method} {url}: {detail}")
    except URLError as exc:
        raise RuntimeError(f"Request failed {method} {url}: {exc.reason}")


def request_text_with_resolve(method, parsed, body, headers, ip):
    connection_class = ResolvedHTTPSConnection if parsed.scheme == "https" else ResolvedHTTPConnection
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    path = urlunparse(("", "", parsed.path or "/", "", parsed.query, parsed.fragment))
    connection = connection_class(parsed.hostname, port, resolved_ip=ip, timeout=30)
    try:
        connection.request(method, path, body=body, headers={**headers, "Host": parsed.netloc})
        response = connection.getresponse()
        text = response.read().decode("utf-8")
        if response.status >= 400:
            raise RuntimeError(f"HTTP {response.status} {method} {parsed.geturl()}: {text}")
        return text
    finally:
        connection.close()


class ResolvedHTTPConnection(HTTPConnection):
    def __init__(self, host, port=None, resolved_ip=None, timeout=30):
        super().__init__(host, port=port, timeout=timeout)
        self.resolved_ip = resolved_ip

    def connect(self):
        self.sock = socket.create_connection((self.resolved_ip, self.port), self.timeout, self.source_address)


class ResolvedHTTPSConnection(HTTPSConnection):
    def __init__(self, host, port=None, resolved_ip=None, timeout=30):
        super().__init__(host, port=port, timeout=timeout)
        self.resolved_ip = resolved_ip

    def connect(self):
        raw_sock = socket.create_connection((self.resolved_ip, self.port), self.timeout, self.source_address)
        context = self._context or ssl.create_default_context()
        self.sock = context.wrap_socket(raw_sock, server_hostname=self.host)


def event_payload(args):
    payload = {
        "title": args.title,
        "startsAt": args.starts_at,
        "endsAt": args.ends_at,
        "timezone": args.timezone,
        "status": args.status,
    }
    for key, attr in [("id", "id"), ("description", "description"), ("location", "location"), ("rrule", "rrule")]:
        value = getattr(args, attr)
        if value:
            payload[key] = value
    return payload


def api_base(args):
    return normalize_api_base(args.api_base)


def normalize_api_base(value):
    if not value:
        raise RuntimeError("Missing --api-base or AGENT_CALENDAR_API_BASE")
    return value.rstrip("/")


def url_for_api_base(url, base):
    parsed_url = urlparse(url)
    parsed_base = urlparse(base)
    return urlunparse((parsed_base.scheme, parsed_base.netloc, parsed_url.path, "", parsed_url.query, parsed_url.fragment))


def webcal_for_api_base(url, base):
    parsed_url = urlparse(url_for_api_base(url, base))
    return urlunparse(("webcal", parsed_url.netloc, parsed_url.path, "", parsed_url.query, parsed_url.fragment))


def redact_profile(profile, message=None):
    output = dict(profile)
    if "updateToken" in output:
        output["updateToken"] = "<redacted>"
    if message:
        output = {"message": message, **output}
    return output


def print_json(value):
    print(json.dumps(value, indent=2, sort_keys=True))


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_resolve_env(value):
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def parse_resolve_values(values):
    result = {}
    for value in values:
        if ":" not in value:
            raise RuntimeError(f"Invalid --resolve value {value!r}; expected host:ip")
        host, ip = value.rsplit(":", 1)
        if not host or not ip:
            raise RuntimeError(f"Invalid --resolve value {value!r}; expected host:ip")
        result[host] = ip
    return result


if __name__ == "__main__":
    main()
