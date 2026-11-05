#!/usr/bin/env python3
"""Offline tests for the Agent Office bridge. Synthetic data only (no real client records)."""
import base64
import hashlib
import io
import json
import os
import socket
import stat
import struct
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
from datetime import date, datetime, timedelta, timezone
from pathlib import Path


def _free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


TMP = tempfile.mkdtemp(prefix="bco-office-test-")
PORT = _free_port()
os.environ["BCO_OFFICE_DIR"] = TMP
os.environ["BCO_OFFICE_PORT"] = str(PORT)
os.environ["BCO_ENV_FILE"] = os.path.join(TMP, "runtime.env")
os.environ["BCO_HOTSHEET_PATH"] = os.path.join(TMP, "hotsheet_latest.json")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
Path(TMP, "config.json").write_text(json.dumps({"access_hold_ids":[99000001], "fub_domain":"example", "public_business_number":"201-380-2010"}))
import bridge as B  # noqa: E402

ET = B.ET
# Sunday Nov 1 2026, 10:00 AM ET (EST, UTC-5)
NOW = datetime(2026, 11, 1, 15, 0, tzinfo=timezone.utc)


class Helpers(unittest.TestCase):
    def test_env_reader_takes_only_named_keys(self):
        p = Path(TMP) / "x.env"
        p.write_text("# comment\nexport FUB_API_KEY='abc 123'\nFUB_X_SYSTEM=Sys # trailing\nOTHER=nope\nFUB_X_SYSTEM_KEY=\"k\"\n")
        vals = B.read_env_values(p)
        self.assertEqual(vals, {"FUB_API_KEY": "abc 123", "FUB_X_SYSTEM": "Sys", "FUB_X_SYSTEM_KEY": "k"})
        self.assertEqual(B.read_env_values(Path(TMP) / "missing.env"), {})

    def test_full_display_name(self):
        self.assertEqual(B.display_name("Ada", "Lovelace"), "Ada Lovelace")
        self.assertEqual(B.display_name("Ada", ""), "Ada")
        self.assertEqual(B.display_name("", "Acme LLC"), "Acme LLC")
        self.assertEqual(B.display_name("Unverified Owner (MLS 1)", "x"), "Unverified owner")
        self.assertEqual(B.display_name(None, None), "Unnamed contact")
        self.assertEqual(B.display_name("Bo", "'Neil"), "Bo \'Neil")

    def test_discreet_title(self):
        inv = [{"personId": 5, "name": "Ada Lovelace"}, {"userId": 1, "name": "Igor Beyder"}]
        self.assertEqual(B.discreet_title("Showing with Ada Lovelace", inv), "Showing with Ada Lovelace")
        self.assertEqual(B.discreet_title("Igor Beyder planning", inv), "Igor Beyder planning")

    def test_short_place_and_street(self):
        self.assertEqual(B.short_place("10 Main Street, Closter, NJ 07624"), "10 Main Street, Closter")
        self.assertEqual(B.norm_street("46 Example Road, Alpine, NJ"), "46 example rd")
        self.assertEqual(B.norm_street("46 Example Rd."), "46 example rd")

    def test_fmt_time_is_eastern_12h(self):
        self.assertEqual(B.fmt_time(datetime(2026, 11, 1, 15, 30, tzinfo=timezone.utc)), "10:30 AM")
        self.assertEqual(B.fmt_time(datetime(2026, 7, 1, 17, 5, tzinfo=timezone.utc)), "1:05 PM")

    def test_night(self):
        self.assertTrue(B.is_night(datetime(2026, 11, 2, 4, 0, tzinfo=timezone.utc)))   # 11 PM ET
        self.assertFalse(B.is_night(datetime(2026, 11, 2, 14, 0, tzinfo=timezone.utc)))  # 9 AM ET


class Panels(unittest.TestCase):
    def test_today(self):
        appts = [
            {"start": "2026-11-01T18:30:00Z", "title": "Showing with Ada Lovelace", "location": "1 Elm St, Alpine, NJ",
             "invitees": [{"personId": 5, "name": "Ada Lovelace"}]},
            {"start": "2026-11-01T14:00:00Z", "title": "Team sync", "location": ""},
            {"start": "2026-11-02T14:00:00Z", "title": "Tomorrow"},
            {"start": "2026-11-01T00:00:00Z", "allDay": True, "title": "Open house prep"},
        ]
        tasks = [
            {"personId": 1, "type": "Call", "dueDate": "2026-11-01", "dueDateTime": "2026-11-01T16:00:00Z", "isCompleted": 0},
            {"personId": 2, "type": "Email", "dueDate": "2026-10-30", "isCompleted": 0},
            {"personId": 3, "type": "Text", "dueDate": "2026-10-20", "isCompleted": 0},
            {"personId": 4, "type": "Call", "dueDate": "2026-11-05", "isCompleted": 0},
            {"personId": None, "type": "Follow Up", "dueDate": "2026-11-01", "isCompleted": 0},
            {"personId": 6, "type": "Call", "dueDate": "2026-11-01", "isCompleted": 1},
        ]
        names = {1: "Ada Lovelace", 2: "Bo \'Neil", 3: "Cy Doe"}
        out = B.build_today(tasks, appts, names, NOW)
        self.assertEqual([e["time"] for e in out["events"]], ["All day", "9:00 AM", "1:30 PM"])
        self.assertEqual(out["events"][2]["title"], "Showing with Ada Lovelace")
        self.assertEqual(out["events"][2]["where"], "1 Elm St, Alpine")
        f = out["followups"]
        self.assertEqual((f["due"], f["overdue"]), (1, 2))
        self.assertEqual(f["items"][0], {"who": "Ada Lovelace", "what": "Call", "when": "11:00 AM"})
        self.assertEqual(f["items"][1]["when"], "Overdue · 12d")  # oldest overdue first
        self.assertEqual(f["items"][2], {"who": "Bo \'Neil", "what": "Email", "when": "Overdue · 2d"})

    def test_pipeline(self):
        pipelines = [{"stages": [{"id": 26, "closedStage": True}, {"id": 25, "closedStage": True}]}]
        deals = [
            {"stageId": 20, "stageName": "Listed / Active", "name": "46 Example Rd, Alpine, NJ", "customExpirationDate": "2026-11-10T00:00:00Z"},
            {"stageId": 24, "stageName": "UNDER CONTRACT", "name": "3 Highwood Pl, Closter, NJ",
             "projectedCloseDate": "2026-11-20T00:00:00Z", "finalWalkThroughDate": "2026-11-12T00:00:00Z"},
            {"stageId": 22, "stageName": "ARIP", "name": "9 Oak Ln, Demarest, NJ", "dueDiligenceDate": "2026-11-03T00:00:00Z"},
            {"stageId": 21, "stageName": "Offer", "name": "Buyer A"},
            {"stageId": 19, "stageName": "Buyer Contract", "name": "Buyer B"},
            {"stageId": 34, "stageName": "OFF-MARKET", "name": "1 Hill Rd, Alpine"},
            {"stageId": 26, "stageName": "CLOSED", "name": "Closed this year", "projectedCloseDate": "2026-03-01T00:00:00Z"},
            {"stageId": 25, "stageName": "SOLD", "name": "Closed in 2015", "projectedCloseDate": "2015-10-02T00:00:00Z"},
            {"stageId": 35, "stageName": "LEASED", "name": "Lease", "projectedCloseDate": "2026-05-01T00:00:00Z"},
            {"stageId": 20, "stageName": "Listed / Active", "name": "Old deleted", "status": "Deleted"},
        ]
        out = B.build_pipeline(deals, pipelines, NOW)
        self.assertEqual(out["stages"], {"listings": 1, "underContract": 2, "closing30": 1, "closedYTD": 1,
                                         "offers": 1, "offMarket": 1, "buyerContracts": 1})
        self.assertEqual([(d["date"], d["label"]) for d in out["dates"]],
                         [("2026-11-03", "Due diligence"), ("2026-11-10", "Listing expires"), ("2026-11-12", "Walk-through")])
        self.assertEqual(out["dates"][1]["deal"], "46 Example Rd, Alpine")

    def test_buyers(self):
        recent = [
            {"id": 10, "created": "2026-10-31T12:00:00Z", "firstName": "Ann", "lastName": "Lee", "source": "beyderco.com", "assignedUserId": 1},
            {"id": 11, "created": "2026-10-30T12:00:00Z", "firstName": "Vend", "lastName": "Or", "tags": ["Vendor Solicitation"], "assignedUserId": 1},
            {"id": 12, "created": "2026-10-29T12:00:00Z", "firstName": "Other", "lastName": "Agent", "assignedUserId": 7},
            {"id": 13, "created": "2026-10-01T12:00:00Z", "firstName": "Old", "lastName": "Lead", "assignedUserId": 1},
        ]
        ev = lambda pid, typ, days, city="Closter", mls="1": {"personId": pid, "type": typ, "source": "RealScout",
                                                          "occurred": B.iso_z(NOW - timedelta(days=days)),
                                                          "property": {"city": city, "mlsNumber": mls}}
        events = [ev(20, "Viewed Property", 1), ev(20, "Viewed Property", 2), ev(20, "Viewed Property", 3, "Alpine"),
                  ev(21, "Saved Property", 1), ev(22, "Viewed Property", 1), ev(23, "Property Inquiry", 9),
                  ev(24, "Viewed Page", 1)]
        people = {20: {"firstName": "Hot", "lastName": "Viewer", "customRealScoutScoutScore": "93"},
                  21: {"firstName": "Saver", "lastName": "One"}}
        tasks = [{"personId": 1, "dueDate": "2026-10-01", "isCompleted": 0}, {"personId": 2, "dueDate": "2026-11-01", "isCompleted": 0}]
        out = B.build_buyers(recent, events, people, tasks, NOW, 1)
        self.assertEqual([l["name"] for l in out["newLeads"]], ["Ann Lee"])
        self.assertEqual(out["hot"][0], {"name": "Hot Viewer", "signal": "3 views · Closter", "score": 93})
        self.assertEqual(out["hot"][1], {"name": "Saver One", "signal": "1 saved · Closter", "score": None})
        self.assertEqual(len(out["hot"]), 2)  # a single view or an old inquiry is not "hot"
        self.assertEqual(out["overdue"], 1)


class HotSheet(unittest.TestCase):
    def test_kind_words(self):
        for raw, kind in [("New Listing", "new"), ("Price Change", "price"), ("Back on Market", "bom"), ("Back On Market", "bom"),
                          ("Under Contract", "uc"), ("Pending", "uc"), ("Sold", "sold"), ("Coming Soon", "coming"),
                          ("Open House", "open"), ("bom", "bom"), ("Price Reduction", "price"), ("Price Decrease", "price"),
                          ("price_changes", "price"), ("new_listings", "new"), ("under_contract", "uc"),
                          ("", None), ("weird", None), ("Luxurious", None)]:
            self.assertEqual(B.hot_kind(raw), kind, raw)

    def v1_doc(self, **extra):
        row = lambda **kw: dict({"mls": "1", "address": "1 Test Ct", "town": "Alpine", "list_price": "$2,500,000", "price_num": 2500000,
                                 "style": "Colonial", "br": "5", "fb": "4", "hb": "1", "dom": "3", "status": "A",
                                 "chg_type": "New Listing", "chg_info": "->A", "close_price": "", "close_date": ""}, **kw)
        doc = {"schema": "bco.njmls_hotsheet/v1", "generated_at": "2026-11-01T11:06:41.123456+00:00", "source": "NJMLS Matrix Market Watch",
               "session_ok": True, "towns": ["Alpine", "Closter", "Tenafly"],
               "groups": {
                   "new_listings": [row(mls="10", address="5 Ridge Rd", town="Tenafly", list_price="$3,100,000", price_num=3100000),
                                    row(mls="11", address="46 Example Road", town="Alpine", list_price="$4,250,000", price_num=4250000),
                                    row(mls="12", address="2 Low St", town="Closter", list_price="$650,000", price_num=650000),
                                    row(mls="13", address="8 Main St", town="Closter", chg_type="Back On Market", list_price="$1,800,000", price_num=1800000)],
                   "under_contract": [row(mls="20", address="9 Elm St", town="Closter", chg_type="Under Contract", list_price="$1,950,000", price_num=1950000)],
                   "sold": [row(mls="30", address="3 Oak Ln", town="Closter", chg_type="Sold", list_price="$2,000,000", price_num=2000000,
                                close_price="$1,900,000", close_date="10/30/2026")],
                   "price_changes": [row(mls="40", address="7 Hill Rd", town="Alpine", chg_type="Price Decrease", list_price="$2,395,000",
                                         price_num=2395000, chg_info="$2,495,000->$2,395,000")]},
               "counts": {"new_listings": 4, "under_contract": 1, "sold": 1, "price_changes": 1}}
        doc.update(extra)
        return doc

    def test_v1_schema(self):
        msg = B.build_hotsheet(self.v1_doc(), {"10": 2}, {"46 example rd"}, NOW, None, floor=1_000_000, focus=["Alpine", "Closter"])
        self.assertEqual((msg["status"], msg["asOf"]), ("stale", "2026-11-01T11:06:41.123456Z"))
        rows = msg["rows"]
        self.assertEqual([r["mls"] for r in rows], ["11", "10", "13", "40", "20", "30"])  # ours, then kind order, focus towns, price
        by = {r["mls"]: r for r in rows}
        self.assertTrue(by["11"]["ours"])
        self.assertEqual(by["10"]["views"], 2)
        self.assertEqual((by["10"]["beds"], by["10"]["baths"], by["10"]["dom"]), (5.0, 4.5, 3.0))
        self.assertEqual(by["13"]["kind"], "bom")
        self.assertEqual((by["40"]["kind"], by["40"]["price"], by["40"]["was"]), ("price", 2395000, 2495000.0))
        self.assertEqual((by["30"]["kind"], by["30"]["price"], by["30"]["was"]), ("sold", 1900000.0, 2000000))
        self.assertNotIn("12", by)  # under the $1M floor
        self.assertTrue(all(r["at"] == "2026-11-01T11:06:41.123456Z" for r in rows))

    def test_v1_dead_session_and_stale(self):
        msg = B.build_hotsheet(self.v1_doc(session_ok=False), {}, set(), NOW, None)
        self.assertEqual(msg["status"], "stale")
        self.assertTrue(msg["note"].startswith("Double-click NJMLS LOGIN on the Studio desktop · last pull Nov 1, 6:06 AM"))
        self.assertTrue(msg["rows"])  # the last pull stays on screen
        old = self.v1_doc(generated_at="2026-10-28T12:00:00+00:00")
        msg = B.build_hotsheet(old, {}, set(), NOW, None)
        self.assertEqual(msg["status"], "stale")
        self.assertIn("Oct 28", msg["note"])

    def test_other_layouts(self):
        flat = {"generated_at": "2026-11-01T13:00:00Z", "listings": [
            {"change_type": "Price Change", "address": "46 Example Road, Alpine", "price": "$4,250,000", "previous_price": 4500000, "mls_number": "123"},
            {"change_type": "New Listing", "street": "5 Oak Ln", "city": "Demarest", "list_price": 2100000, "mls": "456"},
            {"change_type": "", "address": "skip me"}]}
        rows = B.build_hotsheet(flat, {"456": 3}, set(), NOW, None, floor=0)["rows"]
        self.assertEqual({(r["kind"], r["town"]) for r in rows}, {("price", "Alpine"), ("new", "Demarest")})
        nested = {"data": {"updatedAt": "2026-11-01T11:00:00Z", "rows": [{"kind": "open", "address": "3 C St", "town": "Alpine", "price": 3000000, "openAt": "Sun 1–3 PM"}]}}
        self.assertEqual(B.build_hotsheet(nested, {}, set(), NOW, None)["rows"][0]["openAt"], "Sun 1–3 PM")
        self.assertEqual(B.build_hotsheet({"rows": [{"foo": "bar"}]}, {}, set(), NOW, None)["status"], "error")


class FakeResp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class FakeOpener:
    def __init__(self, routes):
        self.routes = routes  # list of (predicate(url) -> bool, response or exception)
        self.urls = []
        self.headers = []

    def open(self, req, timeout=None):
        self.urls.append(req.full_url)
        self.headers.append(dict(req.header_items()))
        for pred, resp in self.routes:
            if pred(req.full_url):
                if isinstance(resp, Exception):
                    raise resp
                return FakeResp(json.dumps(resp).encode())
        raise AssertionError("unexpected " + req.full_url)


def creds():
    return {"FUB_API_KEY": "k", "FUB_X_SYSTEM": "S", "FUB_X_SYSTEM_KEY": "SK"}


class FubClient(unittest.TestCase):
    def test_paging_headers_and_pacing(self):
        op = FakeOpener([
            (lambda u: "next=p2" in u, {"tasks": [{"id": 2}], "_metadata": {"next": None}}),
            (lambda u: "/tasks" in u, {"tasks": [{"id": 1}], "_metadata": {"next": "p2"}}),
        ])
        slept = []
        clock = [1000.0]
        def sleep(seconds):
            slept.append(seconds)
            clock[0] += seconds
        fub = B.Fub(creds_fn=creds, opener=op, sleeper=sleep, clock=lambda: clock[0])
        items = fub.pages("/tasks", {"isCompleted": "false", "limit": 100}, "tasks")
        self.assertEqual([i["id"] for i in items], [1, 2])
        self.assertTrue(op.urls[0].startswith("https://api.followupboss.com/v1/tasks?isCompleted=false"))
        h = {k.lower(): v for k, v in op.headers[0].items()}
        self.assertEqual(h["authorization"], "Basic " + base64.b64encode(b"k:").decode())
        self.assertEqual((h["x-system"], h["x-system-key"]), ("S", "SK"))
        self.assertTrue(slept and slept[0] > 0.5)  # second call waited

    def test_stop_condition(self):
        op = FakeOpener([(lambda u: "/events" in u, {"events": [{"id": 9, "occurred": "2020-01-01T00:00:00Z"}], "_metadata": {"next": "more"}})])
        fub = B.Fub(creds_fn=creds, opener=op, sleeper=lambda s: None)
        out = fub.pages("/events", {"limit": 100}, "events", stop=lambda e: True)
        self.assertEqual(len(out), 1)
        self.assertEqual(len(op.urls), 1)

    def test_errors(self):
        def http(code, headers=None):
            return urllib.error.HTTPError("u", code, "x", headers or {}, None)
        for code, cls in ((401, B.FubAuthError), (403, B.FubAuthError), (500, B.FubError)):
            fub = B.Fub(creds_fn=creds, opener=FakeOpener([(lambda u: True, http(code))]), sleeper=lambda s: None)
            with self.assertRaises(cls):
                fub.get("/people")
        fub = B.Fub(creds_fn=creds, opener=FakeOpener([(lambda u: True, http(429, {"Retry-After": "12"}))]), sleeper=lambda s: None)
        with self.assertRaises(B.FubRateLimited) as ctx:
            fub.get("/people")
        self.assertGreaterEqual(ctx.exception.wait, 12.0)
        fub = B.Fub(creds_fn=lambda: {}, opener=FakeOpener([]), sleeper=lambda s: None)
        with self.assertRaises(B.FubAuthError):
            fub.get("/people")


class FakeFub:
    """Answers the poller's calls from canned synthetic data."""

    def __init__(self, fail=None, me_id=1):
        self.calls = 0
        self.fail = fail
        self.me_id = me_id
        self.people_ids = []

    def get(self, path, params=None):
        self.calls += 1
        if self.fail:
            raise self.fail
        if path == "/me":
            return {"id": self.me_id, "outboundNumber": "+12015550000"}
        if path == "/identity":
            return {"account": {"domain": "example"}}
        if path.startswith("/notes/"):
            return {"personId": 1, "body": "Draft text"}
        if path == "/pipelines":
            return {"pipelines": [{"stages": [{"id": 26, "closedStage": True}]}]}
        if path == "/people" and params and params.get("id"):
            self.people_ids += [int(x) for x in params["id"].split(",")]
            self.people_params = dict(params)
            people = [{"id": 1, "firstName": "Ada", "lastName": "Lovelace"},
                      {"id": 20, "firstName": "Hot", "lastName": "Viewer", "customRealScoutScoutScore": 80}]
            if params.get("includeTrash") == "true":  # Follow Up Boss leaves the trash out unless asked
                people.append({"id": 40, "firstName": "Vend", "lastName": "Or", "stage": "Trash", "tags": ["Vendor Solicitation"]})
            return {"people": people}  # 41 was deleted: never returned
        if path == "/people":
            return {"people": [{"id": 30, "created": B.iso_z(datetime.now(timezone.utc) - timedelta(hours=3)),
                                "firstName": "New", "lastName": "Lead", "source": "beyderco.com", "assignedUserId": 1}]}
        if path in ("/events", "/textMessages"):
            key = path[1:]
            return {key: self.pages(path, params, key)}
        raise AssertionError(path)

    def pages(self, path, params, key, max_pages=5, stop=None):
        self.calls += 1
        if self.fail:
            raise self.fail
        now = datetime.now(timezone.utc)
        today = now.astimezone(ET).date().isoformat()
        if path == "/people":
            self.people_params = dict(params)
            a = self.get(path, {"id": "1,20,40", "includeTrash": "true"})["people"]
            return a + self.get(path)["people"]
        if path == "/tasks":
            return [{"personId": 1, "type": "Call", "dueDate": today, "isCompleted": 0},
                    {"personId": 99000001, "type": "Call", "dueDate": today, "isCompleted": 0},
                    {"id": 4280, "personId": 40, "name": "✋ Call Prep #12 · Vend", "type": "Call", "dueDate": today, "isCompleted": 0},
                    {"id": 4290, "personId": 41, "type": "Text", "dueDate": today, "isCompleted": 0}]
        if path == "/appointments":
            return []
        if path == "/deals":
            return [{"stageId": 20, "stageName": "Listed / Active", "name": "46 Example Rd, Alpine, NJ"}]
        if path == "/events":
            mk = lambda i: {"id": i, "personId": 20, "type": "Viewed Property", "occurred": B.iso_z(now - timedelta(hours=2)),
                            "property": {"city": "Alpine", "mlsNumber": "777"}}
            return [mk(1), mk(2)]
        if path == "/emEvents":
            return [{"personId": 1, "type": "open", "count": 1, "campaignId": 5, "created": B.iso_z(now - timedelta(hours=1)),
                     "updated": B.iso_z(now - timedelta(hours=1))}]
        if path == "/textMessages":
            return [{"id": 77, "personId": 1, "sent": B.iso_z(now - timedelta(hours=1)), "deliveryStatus": "Delivered"}]
        raise AssertionError(path)


class Poller(unittest.TestCase):
    def test_cycle_publishes_new_screens(self):
        hub = B.Hub()
        p = B.FubPoller(FakeFub(), hub)
        p.cycle()
        msgs = {m.get("key") or m["type"]: m for m in hub.messages()}
        self.assertTrue(any("opened your email" in i["text"] for i in msgs["feed"]["data"]["items"]))
        self.assertTrue(any("was sent a text" in i["text"] for i in msgs["feed"]["data"]["items"]))
        self.assertEqual(msgs["needs"]["data"]["items"][0]["link"], "https://example.followupboss.com/2/people/view/1")
        self.assertIn("engaged", msgs["highlights"]["data"])
        self.assertEqual(msgs["approvals"]["type"], "approvals")
        self.assertEqual(p.number, "+12015550000")

    def test_cycle_publishes_three_panels(self):
        hub = B.Hub()
        p = B.FubPoller(FakeFub(), hub)
        p.cycle()
        msgs = {m.get("key") or m["type"]: m for m in hub.messages()}
        self.assertEqual(msgs["today"]["data"]["followups"]["items"][0]["who"], "Ada Lovelace")
        self.assertEqual(msgs["pipeline"]["data"]["stages"]["listings"], 1)
        self.assertEqual(msgs["buyers"]["data"]["newLeads"][0]["name"], "New Lead")
        self.assertEqual(msgs["buyers"]["data"]["hot"][0]["score"], 80)
        self.assertEqual(p.viewers, {"777": 1})
        self.assertEqual(p.our_streets, {"46 example rd"})
        for key in ("today", "pipeline", "buyers"):
            self.assertEqual(msgs[key]["data"]["status"], "live")

    def test_access_holds_and_account_check(self):
        hub = B.Hub()
        fake = FakeFub()
        p = B.FubPoller(fake, hub)
        p.cycle()
        self.assertNotIn(99000001, fake.people_ids)  # held record never read individually
        today = {m.get("key"): m for m in hub.messages()}["today"]["data"]["followups"]
        self.assertEqual(today["due"], 2)  # still counted
        self.assertEqual([i["who"] for i in today["items"]], ["Ada Lovelace"])  # never shown
        with self.assertRaises(B.FubAuthError):
            B.FubPoller(FakeFub(me_id=99), B.Hub()).cycle()

    def test_trash_vendors_and_deleted_contacts_reach_no_screen(self):
        hub = B.Hub()
        fake = FakeFub()
        p = B.FubPoller(fake, hub)
        p.cycle()
        self.assertEqual(fake.people_params.get("includeTrash"), "true")
        msgs = {m.get("key") or m["type"]: m for m in hub.messages()}
        shown = [i.get("pid") for i in msgs["needs"]["data"]["items"]]
        self.assertNotIn(40, shown)  # trashed vendor: its prep task is neither a need …
        self.assertNotIn(41, shown)  # … nor is a contact Follow Up Boss no longer returns
        self.assertEqual([g["gateId"] for g in msgs["approvals"]["items"]], [])  # … nor an approval
        self.assertEqual(msgs["today"]["data"]["followups"]["due"], 2)  # held ones still count; junk does not
        self.assertEqual(p.notes.get(12), None)  # a vendor's draft is never fetched for a screen either

    def test_problem_before_and_after_success(self):
        hub = B.Hub()
        p = B.FubPoller(FakeFub(), hub)
        p.publish_problem(B.FubAuthError("no FUB_API_KEY in the runtime .env"))
        msgs = {m.get("key") or m["type"]: m for m in hub.messages()}
        self.assertEqual(msgs["today"]["data"]["status"], "error")
        self.assertEqual(msgs["today"]["data"]["note"], "No Follow Up Boss API key found on the Studio")
        self.assertEqual(msgs["bridge"]["feeds"]["fub"]["state"], "auth")
        p.cycle()
        p.publish_problem(B.FubError("URLError"))
        msgs = {m.get("key") or m["type"]: m for m in hub.messages()}
        self.assertEqual(msgs["buyers"]["data"]["status"], "stale")
        self.assertTrue(msgs["buyers"]["data"]["note"].startswith("Follow Up Boss is unreachable · showing"))
        self.assertEqual(msgs["buyers"]["data"]["newLeads"][0]["name"], "New Lead")  # last good data kept


class Markets(unittest.TestCase):
    def test_parse_and_items(self):
        obs = B.parse_fred_csv("observation_date,DGS10\n2026-10-29,5.10\n2026-10-30,\n2026-10-30,5.04\n")
        self.assertEqual(len(obs), 2)
        it = B.market_item("DGS10", "10-yr Treasury", "Bonds", "pct", obs)
        self.assertEqual(it["text"], "10-yr Treasury 5.04% ▼6 bp · Oct 30, 2026")
        self.assertEqual((it["value"], it["delta"], it["dir"], it["group"]), ("5.04%", -6, -1, "Bonds"))
        wk = B.market_item("MORTGAGE30US", "30-yr fixed", "Mortgage", "pct", [(datetime(2026, 10, 22).date(), 7.32), (datetime(2026, 10, 29).date(), 7.24)])
        self.assertEqual(wk["text"], "30-yr fixed 7.24% ▼8 bp · Oct 29, 2026 · weekly")
        self.assertEqual(wk["source"], "Freddie Mac")
        curve = B.market_item("T10Y2Y", "2s10s curve", "Bonds", "bp", [(datetime(2026, 10, 29).date(), 0.30), (datetime(2026, 10, 30).date(), 0.33)])
        self.assertEqual((curve["value"], curve["move"]), ("+33 bp", "▲3 bp"))
        flat = B.market_item("DFF", "Fed funds", "Bonds", "pct", [(datetime(2026, 10, 29).date(), 4.33), (datetime(2026, 10, 30).date(), 4.33)])
        self.assertEqual(flat["move"], "unch")
        self.assertIsNone(B.market_item("X", "x", "", "pct", []))
        d = lambda n: datetime(2026, 10, n).date()
        sp = B.spread_item([(d(29), 7.147), (d(30), 7.147)], [(d(29), 5.0), (d(30), 5.04)])
        self.assertEqual((sp["label"], sp["value"]), ("Mortgage spread", "+211 bp"))

    def test_pmms_fallback_parse(self):
        csv = "date,pmms30,pmms30p,pmms15,pmms15p\n10/22/2026,7.32, ,6.68,\n10/29/2026,7.24, ,6.60,\n"
        pm = B.parse_pmms_csv(csv)
        self.assertEqual(pm["MORTGAGE30US"][-1][1], 7.24)
        self.assertEqual(pm["MORTGAGE15US"][0][1], 6.68)

    def test_poller_series_fallback_cache_and_headers(self):
        calls = []

        def fetch(url):
            calls.append(url)
            if "PMMS" in url:
                return "date,pmms30,pmms30p,pmms15\n10/22/2026,7.32, ,6.68\n10/29/2026,7.24, ,6.60\n"
            if "MORTGAGE" in url:
                raise OSError("down")
            sid = url.split("id=")[1].split("&")[0]
            return f"observation_date,{sid}\n2026-10-29,5.00\n2026-10-30,5.04\n"
        cache = Path(TMP) / "markets_test.json"
        mp = B.MarketsPoller(fetch=fetch, cache=cache, pause=0)
        seen = []
        mp.on_update = lambda: seen.append(1)
        mp.refresh()
        ids = [i["id"] for i in mp.latest]
        self.assertEqual(ids[0], "DGS10")
        self.assertIn("MORTGAGE30US", ids)  # from Freddie Mac's own file
        self.assertIn("SPREAD", ids)
        self.assertEqual(ids.index("SPREAD"), ids.index("MORTGAGE15US") + 1)
        self.assertTrue(any("PMMS" in c for c in calls))
        self.assertEqual(seen, [1])
        self.assertTrue(cache.exists())
        again = B.MarketsPoller(fetch=lambda u: (_ for _ in ()).throw(OSError("x")), cache=cache, pause=0)
        self.assertTrue(again.cached)
        self.assertEqual(len(again.latest), len(mp.latest))
        # the request carries a User-Agent and no Accept header (FRED holds the socket otherwise)
        got = {}
        real = B.urllib.request.urlopen

        class R(io.BytesIO):
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        def fake_open(req, timeout=None, context=None):
            got.update({k.lower(): v for k, v in req.header_items()})
            return R(b"observation_date,DGS10\n2026-10-30,5.04\n")
        B.urllib.request.urlopen = fake_open
        try:
            B.MarketsPoller(pause=0)._fetch("https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10")
        finally:
            B.urllib.request.urlopen = real
        self.assertIn("user-agent", got)
        self.assertNotIn("accept", got)

    def test_gives_up_after_consecutive_timeouts(self):
        calls = []

        def fetch(url):
            calls.append(url)
            raise TimeoutError("slow")
        hub = B.Hub()
        mp = B.MarketsPoller(fetch=fetch, hub=hub, pause=0)
        mp.refresh(give_up_after=2)
        self.assertEqual(len([c for c in calls if "stlouisfed" in c]), 2)
        self.assertEqual(hub.feeds["rates"]["state"], "error")

    # the publishers' own files, as they answered on 2026-11-02 (trimmed)
    NOMINAL = ('Date,"1 Mo","1.5 Month","2 Mo","3 Mo","4 Mo","6 Mo","1 Yr","2 Yr","3 Yr","5 Yr","7 Yr","10 Yr","20 Yr","30 Yr"\n'
               "11/02/2026,4.05,4.09,4.16,4.21,4.19,4.25,4.38,4.59,4.65,4.70,4.79,4.91,5.31,5.28\n"
               "10/30/2026,4.06,4.09,4.16,4.16,4.18,4.25,4.36,4.56,4.65,4.71,4.80,4.94,5.34,5.31\n"
               "10/29/2026,4.06,4.08,4.17,4.18,4.21,4.28,4.42,4.61,4.73,4.78,4.87,4.98,5.35,5.32\n"
               "10/22/2026,4.07,4.10,4.16,4.18,4.22,4.32,4.47,4.67,4.80,4.85,4.95,5.00,5.38,5.36\n")
    REAL = ('Date,"5 YR","7 YR","10 YR","20 YR","30 YR"\n'
            "11/02/2026,2.31,2.45,2.62,2.91,3.06\n10/30/2026,2.25,2.42,2.60,2.92,3.08\n")
    EFFR = ('{ "refRates": [ { "effectiveDate": "2026-10-30", "type": "EFFR", "percentRate": 3.88, "targetRateFrom": 3.75, "targetRateTo": 4.00 },'
            ' { "effectiveDate": "2026-10-29", "type": "EFFR", "percentRate": 3.88, "targetRateFrom": 3.75, "targetRateTo": 4.00 } ] }')
    SOFR = ('{ "refRates": [ { "effectiveDate": "2026-10-30", "type": "SOFR", "percentRate": 3.95 },'
            ' { "effectiveDate": "2026-10-29", "type": "SOFR", "percentRate": 3.94 } ] }')
    PMMS = "date,pmms30,pmms30p,pmms15,pmms15p\n10/22/2026,7.32, ,6.68,\n10/29/2026,7.24, ,6.60,\n"

    def publishers(self, fred=None, years=None):
        """A fetch that answers like the publishers; FRED as `fred(sid)` (raise for down)."""
        calls = []

        def fetch(url):
            calls.append(url)
            if "treasury.gov" in url:
                year = int(url.split("rates.csv/")[1].split("/")[0])
                body = (years or {}).get(year, self.REAL if "real_yield" in url else self.NOMINAL)
                if isinstance(body, tuple):
                    body = body[1] if "real_yield" in url else body[0]
                if body is None:
                    raise OSError("not published")
                return body
            if "effr" in url:
                return self.EFFR
            if "sofr" in url:
                return self.SOFR
            if "PMMS" in url:
                return self.PMMS
            if "stlouisfed" in url:
                sid = url.split("id=")[1].split("&")[0]
                if fred is None:
                    raise TimeoutError("FRED holds the connection")
                return fred(sid)
            raise OSError("unexpected " + url)
        return fetch, calls

    def test_treasury_and_nyfed_parse(self):
        tre = B.parse_treasury_csv(self.NOMINAL, {"DGS10": "10 Yr", "DGS2": "2 yr"})
        self.assertEqual(tre["DGS10"][0], (datetime(2026, 10, 22).date(), 5.00))  # oldest first
        self.assertEqual(tre["DGS10"][-1], (datetime(2026, 11, 2).date(), 4.91))
        self.assertEqual(tre["DGS2"][-1][1], 4.59)  # headings match in any case
        real = B.parse_treasury_csv(self.REAL + "10/29/2026,2.31,,N/A,2.9,3.0\n", {"DFII10": "10 Yr"})
        self.assertEqual([v for _d, v in real["DFII10"]], [2.60, 2.62])  # a blank or N/A cell is skipped
        self.assertEqual(B.parse_treasury_csv("", {"DGS10": "10 Yr"}), {})
        self.assertEqual(B.parse_nyfed_json(self.EFFR)[-1], (datetime(2026, 10, 30).date(), 3.88))
        self.assertEqual(B.parse_nyfed_json(self.EFFR, "targetRateTo")[0][1], 4.0)
        self.assertEqual(B.parse_nyfed_json("<html>busy</html>"), [])
        self.assertEqual(B.diff_series(tre["DGS10"], tre["DGS2"])[-1][1], 0.32)

    def test_twelve_from_the_publishers_and_never_fred(self):
        fetch, calls = self.publishers(fred=lambda sid: (_ for _ in ()).throw(AssertionError("FRED asked for " + sid)))
        hub = B.Hub()
        mp = B.MarketsPoller(fetch=fetch, hub=hub, pause=0)
        mp.refresh()
        self.assertEqual([c for c in calls if "stlouisfed" in c], [])  # a normal round never waits on FRED
        by = {i["id"]: i for i in mp.latest}
        self.assertEqual(len(by), 12)
        self.assertEqual([i["id"] for i in mp.latest], ["DGS10", "DGS2", "DGS5", "DGS30", "T10Y2Y", "DFF", "SOFR", "T10YIE",
                                                         "MORTGAGE30US", "MORTGAGE15US", "SPREAD", "DPRIME"])
        self.assertEqual(by["DGS10"]["text"], "10-yr Treasury 4.91% ▼3 bp · Nov 2, 2026")
        self.assertEqual((by["T10Y2Y"]["value"], by["T10Y2Y"]["move"]), ("+32 bp", "▼6 bp"))  # 4.91 − 4.59, was 4.94 − 4.56
        self.assertEqual((by["T10YIE"]["value"], by["T10YIE"]["move"]), ("2.29%", "▼5 bp"))  # 4.91 − 2.62, was 4.94 − 2.60
        self.assertEqual((by["DFF"]["value"], by["DFF"]["move"], by["DFF"]["source"]), ("3.88%", "unch", "NY Fed"))
        self.assertEqual((by["SOFR"]["value"], by["SOFR"]["move"]), ("3.95%", "▲1 bp"))
        self.assertEqual((by["DGS10"]["source"], by["MORTGAGE30US"]["source"], by["DPRIME"]["source"]),
                         ("U.S. Treasury", "Freddie Mac", "Fed target + 3"))
        self.assertEqual((by["DPRIME"]["value"], by["DPRIME"]["move"]), ("7.00%", "unch"))
        sp = by["SPREAD"]
        self.assertEqual((sp["value"], sp["move"], sp["asOf"], sp["source"]), ("+226 bp", "▼6 bp", "Oct 29, 2026 · weekly", "Freddie Mac − Treasury"))
        self.assertEqual(hub.feeds["rates"]["state"], "ok")
        self.assertEqual(hub.feeds["rates"]["note"], "12 of 12 market indicators · U.S. Treasury, NY Fed, Freddie Mac, Fed target + 3")

    def test_a_publisher_down_is_read_from_fred(self):
        def fred(sid):
            return f"observation_date,{sid}\n2026-10-29,3.90\n2026-10-30,3.96\n"
        fetch, calls = self.publishers(fred)
        hub = B.Hub()
        mp = B.MarketsPoller(fetch=lambda u: (_ for _ in ()).throw(OSError("down")) if "sofr" in u else fetch(u), hub=hub, pause=0)
        mp.refresh()
        self.assertEqual([c.split("id=")[1].split("&")[0] for c in calls if "stlouisfed" in c], ["SOFR"])
        by = {i["id"]: i for i in mp.latest}
        self.assertEqual((by["SOFR"]["value"], by["SOFR"]["source"]), ("3.96%", "FRED"))
        self.assertEqual(hub.feeds["rates"]["note"], "12 of 12 market indicators · U.S. Treasury, NY Fed, Freddie Mac, FRED, Fed target + 3")

    def test_all_down_and_fred_holding_the_line(self):
        fetch, calls = self.publishers(fred=None)
        mp = B.MarketsPoller(fetch=lambda u: (_ for _ in ()).throw(TimeoutError("slow")) if "stlouisfed" not in u else fetch(u),
                             hub=B.Hub(), pause=0)
        mp.refresh(give_up_after=2)
        self.assertEqual(len([c for c in calls if "stlouisfed" in c]), 2)  # left for the round after two in a row
        self.assertEqual(mp.latest, [])

    def test_early_january_reads_last_years_curve_too(self):
        jan = ('Date,"2 Yr","5 Yr","10 Yr","30 Yr"\n01/04/2027,4.50,4.62,4.80,5.20\n', 'Date,"10 YR"\n01/04/2027,2.55\n')
        fetch, calls = self.publishers(years={2027: jan})
        mp = B.MarketsPoller(fetch=fetch, pause=0)
        got = mp.collect(now=datetime(2027, 1, 4, 21, 0, tzinfo=timezone.utc))
        self.assertEqual(got["DGS10"][-2:], [(datetime(2026, 11, 2).date(), 4.91), (datetime(2027, 1, 4).date(), 4.80)])
        self.assertTrue(any("/2026/all" in c for c in calls) and any("/2027/all" in c for c in calls))
        # with two weeks of readings in this year's file, last year's is never asked for
        days = [datetime(2026, 10, 1) + timedelta(days=i) for i in range(12)]
        nominal = 'Date,"2 Yr","5 Yr","10 Yr","30 Yr"\n' + "".join(f"{d:%m/%d/%Y},4.5,4.6,4.9,5.2\n" for d in reversed(days))
        real = 'Date,"10 YR"\n' + "".join(f"{d:%m/%d/%Y},2.6\n" for d in reversed(days))
        fetch2, calls2 = self.publishers(years={2026: (nominal, real)})
        B.MarketsPoller(fetch=fetch2, pause=0).collect(now=datetime(2026, 11, 2, 21, 0, tzinfo=timezone.utc))
        self.assertEqual(len([c for c in calls2 if "treasury.gov" in c]), 2)
        self.assertFalse(any("/2025/all" in c for c in calls2))

    def test_ticker_is_markets_only(self):
        items = [{"kind": "rate", "text": "10-yr Treasury 5.04% ▼6 bp · Oct 30, 2026", "id": "DGS10", "at": "2026-10-30T12:00:00Z"}]
        msg = B.build_ticker(items, NOW)
        self.assertEqual((msg["type"], msg["status"], len(msg["items"])), ("ticker", "live", 1))
        empty = B.build_ticker([], NOW)
        self.assertEqual(empty["status"], "awaiting")


class Feed(unittest.TestCase):
    def setUp(self):
        self.people = {20: {"firstName": "Riley", "lastName": "Brooks", "customRealScoutScoutScore": "84"},
                       21: {"firstName": "Sam", "lastName": "Ortiz"}, 22: {"firstName": "Avery", "lastName": "Stone"},
                       25: {"firstName": "Vend", "lastName": "X", "tags": ["Vendor Solicitation"]},
                       26: {"firstName": "Gone", "lastName": "Away", "stage": "Trash"}}

    def ev(self, pid, typ, hours, street="61 Sample Ave", city="Closter", mls="1", price="3448800", **kw):
        d = {"id": hash((pid, typ, hours, street)) & 0xFFFFFF, "personId": pid, "type": typ,
             "occurred": B.iso_z(NOW - timedelta(hours=hours)), "property": {"street": street, "city": city, "mlsNumber": mls, "price": price}}
        d.update(kw)
        return d

    def test_feed_preserves_names_and_excludes_held_contacts(self):
        hold = next(iter(B.ACCESS_HOLD_IDS))
        events = [self.ev(20, "Viewed Property", 1), self.ev(20, "Viewed Property", 2), self.ev(21, "Saved Property", 5, "5 Oak Ln", "Demarest", "2", "2100000"),
                  self.ev(22, "Property Inquiry", 6, "46 Example Rd", "Alpine", "3", "4250000"), self.ev(hold, "Viewed Property", 1),
                  self.ev(25, "Viewed Property", 1), self.ev(26, "Viewed Property", 1),
                  {"id": 9, "personId": 21, "type": "Viewed Page", "occurred": B.iso_z(NOW - timedelta(hours=3)), "pageTitle": "RealScout | Homes in Alpine"}]
        em = [{"personId": 22, "type": "open", "count": 3, "campaignId": 1, "campaignName": "", "created": B.iso_z(NOW - timedelta(days=2)), "updated": B.iso_z(NOW - timedelta(hours=4))},
              {"personId": 20, "type": "click", "count": 1, "campaignId": 2, "campaignName": "Fall market", "created": B.iso_z(NOW - timedelta(hours=8)), "updated": B.iso_z(NOW - timedelta(hours=8))}]
        tout = [{"id": 1, "personId": 21, "sent": B.iso_z(NOW - timedelta(hours=7)), "deliveryStatus": "Not Delivered", "toNumber": "2015550101"}]
        tin = [{"id": 2, "personId": 20, "sent": B.iso_z(NOW - timedelta(hours=9)), "fromNumber": "2015550199"},
               {"id": 3, "personId": 0, "sent": B.iso_z(NOW - timedelta(hours=10)), "fromNumber": "2015550198"}]
        recent = [{"id": 30, "created": B.iso_z(NOW - timedelta(hours=11)), "firstName": "Casey", "lastName": "Lund", "source": "beyderco.com", "assignedUserId": 1}]
        f = B.build_feed(events, em, tout, tin, recent, self.people, NOW)
        texts = [i["text"] for i in f["items"]]
        self.assertEqual(texts[0], "Riley Brooks viewed 61 Sample Ave, Closter · $3.45M · ×2")
        self.assertIn("Sam Ortiz browsed Homes in Alpine", texts)
        self.assertIn("Avery Stone opened your email", texts)
        self.assertIn("Riley Brooks clicked your email “Fall market”", texts)
        self.assertIn("Sam Ortiz was sent a text not delivered", texts)
        self.assertIn("Riley Brooks texted you", texts)
        self.assertIn("A number ending 0198 texted you", texts)
        self.assertIn("Casey Lund is a new lead from beyderco.com", texts)
        joined = " ".join(texts)
        for absent in ("Vend", "Gone", str(hold), "2015550"):
            self.assertNotIn(absent, joined)
        self.assertEqual(f["items"][0]["link"], "https://example.followupboss.com/2/people/view/20")
        self.assertEqual([i["at"] for i in f["items"]], sorted([i["at"] for i in f["items"]], reverse=True))

    def test_highlights_three_tabs(self):
        P = lambda pid, days, kind="view", w=1.0: (NOW - timedelta(days=days), w, kind)
        points = {
            20: [P(20, 1), P(20, 2, "save", 3), P(20, 3)],                    # busy this week
            21: [P(21, 50), P(21, 2), P(21, 1, "save", 3)],                   # back after a long quiet
            22: [P(22, 30), P(22, 25, "save", 3), P(22, 20), P(22, 18)],       # was engaged, quiet 18 days
            23: [P(23, 3)],                                                    # too little to rank
        }
        h = B.build_highlights(points, self.people, NOW)
        self.assertEqual([r["pid"] for r in h["engaged"]], [20, 21])
        self.assertEqual(h["engaged"][0]["reason"], "1 save · 2 views")
        self.assertEqual(h["engaged"][0]["scoutScore"], 84)
        self.assertEqual([r["pid"] for r in h["reengaged"]], [21])
        self.assertTrue(h["reengaged"][0]["reason"].startswith("back after 48 days"))
        self.assertEqual([r["pid"] for r in h["slipping"]], [22])
        self.assertTrue(h["slipping"][0]["reason"].startswith("quiet 18 days · was"))

    def test_activity_points_weights_and_email_gaps(self):
        em = [{"personId": 20, "type": "open", "count": 2, "created": B.iso_z(NOW - timedelta(days=40)), "updated": B.iso_z(NOW - timedelta(days=1))},
              {"personId": 21, "type": "open", "count": 9, "created": B.iso_z(NOW - timedelta(days=40)), "updated": B.iso_z(NOW - timedelta(days=1))}]
        pts = B.activity_points([], em, [], self.people)
        self.assertEqual(len(pts[20]), 2)
        self.assertGreater((pts[20][1][0] - pts[20][0][0]).days, 30)  # two opens: the gap is real
        self.assertLess((pts[21][1][0] - pts[21][0][0]).total_seconds(), 3600)  # nine: the gap is unknown, so no gap

    def test_needs_order_links_drafts_and_discretion(self):
        today = NOW.astimezone(ET).date()
        tasks = [
            {"id": 1, "personId": 20, "type": "Call", "name": "Call Riley Brooks about Alpine", "dueDate": today.isoformat(), "dueDateTime": B.iso_z(NOW + timedelta(hours=2))},
            {"id": 2, "personId": 21, "type": "Text", "name": "✋ SEND TEXT: personal follow-up with Sam Ortiz — Message Prep #555", "dueDate": today.isoformat()},
            {"id": 3, "personId": 22, "type": "Email", "name": "Follow up", "dueDate": (today - timedelta(days=2)).isoformat()},
            {"id": 4, "personId": 20, "type": "Call", "name": "Later", "dueDate": (today + timedelta(days=3)).isoformat()},
            {"id": 5, "personId": next(iter(B.ACCESS_HOLD_IDS)), "type": "Call", "name": "Held", "dueDate": today.isoformat()},
        ]
        appts = [{"id": 7, "title": "Showing with Riley Brooks", "start": B.iso_z(NOW + timedelta(hours=3)), "invitees": [{"personId": 20, "name": "Riley Brooks"}]}]
        recent = [{"id": 30, "created": B.iso_z(NOW - timedelta(hours=2)), "firstName": "Casey", "lastName": "Lund", "source": "Zillow", "assignedUserId": 1}]
        notes = {555: {"body": "<p>Hi Sam,</p><p>Following up on 5 Oak Ln &amp; the open house.</p>"}}
        system = [{"id": "sys-njmls", "title": "Sign in to NJMLS", "when": "Hot sheet paused"}]
        n = B.build_needs(tasks, appts, recent, self.people, notes, NOW, system)
        groups = [i["group"] for i in n["items"]]
        self.assertEqual(groups, ["overdue", "approval", "lead", "system", "today", "appointment"])
        by_id = {i["id"]:i for i in n["items"]}
        self.assertTrue(all("ageSeconds" in i and i["fubLink"].startswith("https://example.followupboss.com/") for i in n["items"]))
        appr = by_id["fub-task-2"]
        self.assertEqual(appr["title"], "✋ SEND TEXT: personal follow-up with Sam Ortiz · Message Prep")
        self.assertEqual(appr["draft"], "Hi Sam,\n\nFollowing up on 5 Oak Ln & the open house.")
        self.assertEqual(appr["agent"], "crimson")
        self.assertEqual(by_id["fub-task-1"]["title"], "Call Riley Brooks about Alpine")
        self.assertEqual(by_id["fub-task-3"]["when"], "Overdue · 2d")
        self.assertEqual(by_id["fub-appt-7"]["title"], "Showing with Riley Brooks")
        self.assertTrue(all(i.get("link", "").startswith("https://example.followupboss.com/2/people/view/") for i in n["items"] if i["group"] != "system"))
        self.assertNotIn("Held", " ".join(i["title"] for i in n["items"]))
        gates = B.approval_gates(n)
        self.assertEqual(len(gates), 1)
        self.assertEqual((gates[0]["gateId"], gates[0]["agentId"], gates[0]["need"]), ("fub-task-2", "crimson", "Send a text to Sam Ortiz"))
        self.assertIn("existing owner", gates[0]["brief"]["action"])
        self.assertEqual(gates[0]["requestedBy"],"automations")
        self.assertTrue(gates[0]["draft"].startswith("Hi Sam"))

    def test_needs_fleet_tasks_on_no_contact(self):
        today = NOW.astimezone(ET).date()
        tasks = [
            {"id": 9, "personId": 0, "type": "Follow Up", "isCompleted": 0, "dueDate": (today - timedelta(days=1)).isoformat(),
             "name": "Refresh NJMLS Matrix login — seed funnel paused (30-sec fix: double-click RUN_MATRIX_SESSION_LOGIN.command)"},
            {"id": 10, "personId": 0, "type": "Follow Up", "isCompleted": 1, "dueDate": today.isoformat(), "name": "Done already"},
            {"id": 11, "personId": None, "type": "Follow Up", "isCompleted": 0, "dueDate": (today + timedelta(days=2)).isoformat(), "name": "Not yet"},
        ]
        n = B.build_needs(tasks, [], [], self.people, {}, NOW, [])
        self.assertEqual([i["id"] for i in n["items"]], ["fub-task-9"])
        it = n["items"][0]
        self.assertEqual((it["group"], it["kind"], it["link"]), ("system", "system", "https://example.followupboss.com/2/tasks"))
        self.assertTrue(it["title"].startswith("Refresh NJMLS Matrix login"))
        self.assertEqual(B.approval_gates(n), [])

    def test_realscout_activity_counts_only(self):
        now = datetime(2026, 11, 1, 23, 0, tzinfo=timezone.utc)
        ev = lambda pid, typ, hours, src="": {"personId": pid, "type": typ, "source": src, "occurred": B.iso_z(now - timedelta(hours=hours))}
        events = [ev(1, "Viewed Property", 2), ev(2, "Saved Property", 30), ev(3, "Registration", 1, "RealScout"),
                  ev(4, "Note", 3), ev(next(iter(B.ACCESS_HOLD_IDS)), "Viewed Property", 1), ev(5, "Property Inquiry", 200)]
        rs = B.realscout_activity(events, now)
        self.assertEqual((rs["day"], rs["week"]), (2, 3))
        self.assertEqual(B.realscout_activity([], now), {"day": 0, "week": 0, "latest": None})

    def test_system_needs(self):
        hs = {"status": "stale", "note": "The NJMLS session needs a sign-in · last pull Nov 1, 11:54 AM", "signIn": True}
        fleet = {"jobs": [{"label": "com.beyderco.sms-reconcile", "name": "SMS reconcile", "agent": "automations", "ok": False,
                           "summary": "3 rows unmatched", "lastAt": B.iso_z(NOW)}, {"label": "x", "name": "x", "ok": True}]}
        out = B.system_needs(hs, fleet, None)
        self.assertEqual([o["id"] for o in out], ["sys-njmls", "sys-job-com.beyderco.sms-reconcile"])
        self.assertIn("NJMLS LOGIN", out[0]["title"])


class Fleet(unittest.TestCase):
    LISTING = ("PID\tStatus\tLabel\n-\t0\tcom.beyderco.monitor\n4242\t0\tcom.beyderco.realscout.intake\n"
               "-\t75\tcom.beyderco.sms-reconcile\n-\t0\tcom.apple.something\n-\t0\tcom.igorbeyder.agent-office\n")

    def test_parse_list_and_schedules(self):
        lst = B.parse_launchctl_list(self.LISTING)
        self.assertEqual(set(lst), {"com.beyderco.monitor", "com.beyderco.realscout.intake", "com.beyderco.sms-reconcile"})
        self.assertEqual(lst["com.beyderco.realscout.intake"], {"pid": 4242, "exit": 0})
        self.assertEqual(lst["com.beyderco.sms-reconcile"]["exit"], 75)
        s1 = B.schedule_of({"StartInterval": 300})
        self.assertEqual(B.describe_schedule(s1), "every 5 min")
        s2 = B.schedule_of({"StartCalendarInterval": [{"Hour": 12, "Minute": 0}, {"Hour": 17, "Minute": 10}, {"Hour": 22, "Minute": 0}]})
        self.assertEqual(B.describe_schedule(s2), "12:00 PM, 5:10 PM, 10:00 PM")
        self.assertEqual(B.describe_schedule(B.schedule_of({"StartCalendarInterval": {"Hour": 7, "Minute": 15}})), "7:15 AM daily")
        self.assertEqual(B.describe_schedule(B.schedule_of({"StartCalendarInterval": [{"Minute": 5}, {"Minute": 35}]})), "hourly at :05, :35")
        nxt = B.next_run(s2, NOW)  # NOW is 10:00 AM ET
        self.assertEqual(nxt.astimezone(ET).strftime("%H:%M"), "12:00")
        late = datetime(2026, 11, 2, 3, 30, tzinfo=timezone.utc)  # 10:30 PM ET on Nov 1
        self.assertEqual(B.next_run(s2, late).astimezone(ET).strftime("%d %H:%M"), "02 12:00")

    def test_build_fleet_statuses(self):
        lst = B.parse_launchctl_list(self.LISTING)
        scheds = {"com.beyderco.monitor": {"at": [{"Minute": 5}, {"Minute": 35}]}, "com.beyderco.realscout.intake": {"every": 300},
                  "com.beyderco.sms-reconcile": {"at": [{"Hour": 12, "Minute": 0}]}, "com.beyderco.contacts.sync": {"every": 1800}}
        results = {"com.beyderco.monitor": {"ok": True, "summary": "all green", "generated_at": B.iso_z(NOW - timedelta(minutes=20))},
                   "com.beyderco.sms-reconcile": {"ok": False, "summary": "3 rows unmatched", "generated_at": B.iso_z(NOW - timedelta(hours=1))},
                   "com.beyderco.contacts.sync": {"ok": True, "summary": "synced", "generated_at": B.iso_z(NOW - timedelta(hours=50)), "stale_after_h": 2},
                   "com.beyderco.dashboard-publish": {"ok": True, "summary": "published", "generated_at": B.iso_z(NOW - timedelta(minutes=25))}}
        today = {"com.beyderco.monitor": {"ok": 20, "fail": 0}, "com.beyderco.sms-reconcile": {"ok": 1, "fail": 1}}
        started = {"com.beyderco.realscout.intake": NOW - timedelta(minutes=2)}
        fl = B.build_fleet(lst, scheds, results, today, started, NOW)
        st = fl["agents"]
        self.assertEqual(st["scout"]["status"], "WORKING")
        self.assertIn("RealScout intake", st["scout"]["detail"])
        self.assertEqual(st["automations"]["status"], "WAITING")
        self.assertTrue(any(j["agent"]=="automations" and j["summary"]=="3 rows unmatched" and j["ok"] is False for j in fl["jobs"]))
        self.assertEqual(st["engineer"]["status"], "IDLE")
        self.assertEqual(st["publisher"]["status"], "IDLE")
        self.assertFalse(any(j["agent"] == "builder" for j in fl["jobs"]))  # contact sync is a native FUB operation
        self.assertIn("no result for 50 h", st["automations"]["detail"])
        self.assertEqual(fl["doneToday"], 21)
        long = B.build_fleet(lst, scheds, {}, {}, {"com.beyderco.realscout.intake": NOW - timedelta(minutes=55)}, NOW)
        self.assertEqual((long["agents"]["scout"]["status"], long["agents"]["scout"]["stuck"]), ("THINKING", True))

    def test_jobs_without_records_use_their_logs(self):
        lst = B.parse_launchctl_list("PID\tStatus\tLabel\n-\t0\tcom.beyderco.contacts.sync\n-\t75\tcom.beyderco.maintenance\n"
                                     "-\t1\tcom.beyderco.engaged-watch\n")
        scheds = {"com.beyderco.contacts.sync": {"every": 3600}, "com.beyderco.maintenance": {"at": [{"Hour": 2, "Minute": 30}]},
                  "com.beyderco.engaged-watch": {"at": [{"Hour": 7, "Minute": 15}]}}
        fl = B.build_fleet(lst, scheds, {}, {}, {}, NOW, {"com.beyderco.contacts.sync": NOW - timedelta(minutes=29)})
        by = {j["label"]: j for j in fl["jobs"]}
        cs = by["com.beyderco.contacts.sync"]
        self.assertEqual((cs["ok"], cs["lastFrom"], cs["lastAt"]), (True, "log", B.iso_z(NOW - timedelta(minutes=29))))
        self.assertEqual(B.parse_iso(cs["next"]), NOW + timedelta(minutes=31))  # an hour after it last ran
        self.assertTrue(by["com.beyderco.maintenance"]["ok"])  # 75: the day guard, a clean run
        ew = by["com.beyderco.engaged-watch"]
        self.assertEqual((ew["ok"], ew["summary"]), (None, "last exit 1"))  # shown, never raised as a failure it did not report
        self.assertEqual(fl["agents"]["automations"]["status"], "IDLE")
        self.assertIn("Contact sync", fl["agents"]["automations"]["detail"])
        self.assertNotIn("crimson",fl["agents"])  # native FUB work belongs to its Studio lane
        self.assertEqual(fl["failing"], 0)

    def test_watcher_reads_without_touching(self):
        import plistlib
        import sqlite3
        d = Path(tempfile.mkdtemp(prefix="fleet-"))
        (d / "agents").mkdir()
        (d / "results").mkdir()
        with open(d / "agents" / "com.beyderco.monitor.plist", "wb") as fh:
            plistlib.dump({"Label": "com.beyderco.monitor", "StartCalendarInterval": [{"Minute": 5}, {"Minute": 35}]}, fh)
        (d / "logs").mkdir()
        (d / "logs" / "contacts.out").write_text("synced\n")
        with open(d / "agents" / "com.beyderco.contacts.sync.plist", "wb") as fh:
            plistlib.dump({"Label": "com.beyderco.contacts.sync", "StartInterval": 3600,
                           "StandardOutPath": str(d / "logs" / "contacts.out"), "StandardErrorPath": str(d / "logs" / "missing.err")}, fh)
        (d / "results" / "com.beyderco.monitor.json").write_text(json.dumps({"job": "com.beyderco.monitor", "ok": True, "summary": "green",
                                                                              "generated_at": B.iso_z(datetime.now(timezone.utc))}))
        db = d / "ops_events.db"
        con = sqlite3.connect(db)
        con.execute("CREATE TABLE events (id INTEGER PRIMARY KEY, ts TEXT, job TEXT, kind TEXT, ok INTEGER, summary TEXT, data TEXT)")
        con.execute("INSERT INTO events (ts, job, kind, ok) VALUES (?,?,?,?)", (B.iso_z(datetime.now(timezone.utc)), "com.beyderco.monitor", "jobresult", 1))
        con.commit()
        con.close()
        before = {p: p.stat().st_mtime for p in d.rglob("*")}
        hub = B.Hub()
        w = B.FleetWatcher(hub, runner=lambda: self.LISTING, agents_dir=d / "agents", results_dir=d / "results", db=db)
        fl = w.tick()
        self.assertTrue(hub.drives_agents)
        self.assertTrue(hub.meta()["drivesAgents"])
        self.assertEqual(hub.feeds["fleet"]["state"], "ok")  # an exit of 75 alone is not a failure: the record is
        msgs = hub.messages()
        self.assertIn("fleet", [m["type"] for m in msgs])
        self.assertTrue(any(m.get("type") == "status" and m.get("id") == "scout" for m in msgs))
        self.assertGreaterEqual(fl["doneToday"], 1)
        cs = next(j for j in fl["jobs"] if j["label"] == "com.beyderco.contacts.sync")
        self.assertEqual(cs["lastFrom"], "log")  # placed by its log's time, the log itself never opened
        after = {p: p.stat().st_mtime for p in d.rglob("*") if p in before}
        self.assertEqual(before, after)  # nothing written
        empty = B.FleetWatcher(B.Hub(), runner=lambda: "PID\tStatus\tLabel\n", agents_dir=d / "none", results_dir=d / "none", db=d / "none.db")
        empty.tick()
        self.assertFalse(empty.hub.drives_agents)


# ----------------------------------------------------------------------- live server tests

def ws_connect(port, origin=None, host=None):
    s = socket.create_connection(("127.0.0.1", port), timeout=5)
    key = base64.b64encode(os.urandom(16)).decode()
    lines = [f"GET /ws HTTP/1.1", f"Host: {host or f'127.0.0.1:{port}'}", "Upgrade: websocket", "Connection: Upgrade",
             f"Sec-WebSocket-Key: {key}", "Sec-WebSocket-Version: 13"]
    if origin:
        lines.append(f"Origin: {origin}")
    s.sendall(("\r\n".join(lines) + "\r\n\r\n").encode())
    head = b""
    while b"\r\n\r\n" not in head:
        chunk = s.recv(1)
        if not chunk:
            break
        head += chunk
    status = head.split(b"\r\n", 1)[0].decode()
    expect = base64.b64encode(hashlib.sha1((key + B.WS_GUID).encode()).digest()).decode()
    return s, status, expect.encode() in head


def ws_send(s, obj):
    data = json.dumps(obj).encode()
    mask = os.urandom(4)
    head = bytearray([0x81])
    if len(data) < 126:
        head.append(0x80 | len(data))
    else:
        head.append(0x80 | 126)
        head += struct.pack("!H", len(data))
    s.sendall(bytes(head) + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))


def ws_recv(s):
    def exact(n):
        buf = b""
        while len(buf) < n:
            c = s.recv(n - len(buf))
            if not c:
                raise ConnectionError
            buf += c
        return buf
    b1, b2 = exact(2)
    n = b2 & 0x7F
    if n == 126:
        n = struct.unpack("!H", exact(2))[0]
    elif n == 127:
        n = struct.unpack("!Q", exact(8))[0]
    payload = exact(n)
    if b1 & 0x0F == 0x9:
        return ws_recv(s)
    return json.loads(payload.decode())


def http_get(port, path, host=None):
    s = socket.create_connection(("127.0.0.1", port), timeout=5)
    s.sendall(f"GET {path} HTTP/1.1\r\nHost: {host or f'127.0.0.1:{port}'}\r\nConnection: close\r\n\r\n".encode())
    data = b""
    while True:
        c = s.recv(65536)
        if not c:
            break
        data += c
    s.close()
    head, _, body = data.partition(b"\r\n\r\n")
    return int(head.split()[1]), body


class LiveServer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Path(TMP, "office.html").write_text("<!doctype html><title>office</title>")
        cls.server = B.Server(("127.0.0.1", PORT), B.Handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        B.HUB.update("panel:today", {"type": "panel", "key": "today", "data": {"status": "live", "events": []}})

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_serves_office_and_health(self):
        code, body = http_get(PORT, "/")
        self.assertEqual((code, body), (200, b"<!doctype html><title>office</title>"))
        code, body = http_get(PORT, "/health")
        self.assertEqual(code, 200)
        self.assertTrue(json.loads(body)["sourceReadOnly"])
        self.assertFalse(json.loads(body)["readOnly"])
        self.assertEqual(json.loads(body)["commandMode"],"existing_chat_queue")
        self.assertEqual(http_get(PORT, "/nope")[0], 404)

    def test_rejects_foreign_host(self):  # DNS rebinding
        self.assertEqual(http_get(PORT, "/health", host=f"evil.example:{PORT}")[0], 403)
        self.assertEqual(http_get(PORT, "/", host="evil.example")[0], 403)

    def test_rejects_foreign_origin(self):
        s, status, _ = ws_connect(PORT, origin="https://evil.example")
        self.assertIn("403", status)
        s.close()
        s, status, _ = ws_connect(PORT, origin=None)
        self.assertIn("403", status)
        s.close()

    def test_snapshot_and_ledger(self):
        s, status, accepted = ws_connect(PORT, origin=f"http://127.0.0.1:{PORT}")
        self.assertIn("101", status)
        self.assertTrue(accepted)
        snap = ws_recv(s)
        self.assertIsInstance(snap, list)
        self.assertEqual(snap[0]["type"], "bridge")
        self.assertFalse(snap[0]["drivesAgents"])
        self.assertIn("today", [m.get("key") for m in snap])
        ws_send(s, {"type": "hello", "office": "test"})
        self.assertEqual(ws_recv(s)["type"], "bridge")
        ws_send(s, {"type": "decision", "gateId": "g1", "agentId": "crimson", "decision": "changes",
                    "message": "Use the 9 AM slot", "need": "Approve the send", "at": "2026-11-01T15:00:00Z", "secret": {"x": 1}})
        ack = ws_recv(s)
        self.assertEqual((ack["type"], ack["recorded"]), ("ack", True))
        decided = ws_recv(s)  # every open office learns the answer
        self.assertEqual(decided["type"], "decided")
        self.assertIn({"gateId": "g1", "decision": "changes"}, decided["gates"])
        line = json.loads(B.LEDGER.read_text().strip().splitlines()[-1])
        self.assertEqual((line["decision"], line["message"]), ("changes", "Use the 9 AM slot"))
        self.assertNotIn("secret", line)
        self.assertEqual(stat.S_IMODE(os.stat(B.LEDGER).st_mode), 0o600)
        # live update reaches the open socket
        B.HUB.update("panel:buyers", {"type": "panel", "key": "buyers", "data": {"status": "live"}})
        self.assertEqual(ws_recv(s)["key"], "buyers")
        s.close()
        # a fresh connection gets the ledger's answers replayed, so a reload never asks twice
        s, _, _ = ws_connect(PORT, origin=f"http://127.0.0.1:{PORT}")
        snap = ws_recv(s)
        self.assertEqual(snap[-1]["type"], "decided")
        self.assertIn({"gateId": "g1", "decision": "changes"}, snap[-1]["gates"])
        s.close()

    def test_decided_gates_reads_latest_and_skips_damage(self):
        B._private_dir()
        existed = B.LEDGER.exists()
        before = B.LEDGER.read_bytes() if existed else b""
        try:
            with open(B.LEDGER, "a", encoding="utf-8") as f:
                f.write('{"type": "decision", "gateId": "real-x", "decision": "decline"}\n')
                f.write("not json\n")
                f.write('{"type": "assign", "gateId": "real-y", "decision": "approve"}\n')
                f.write('{"type": "decision", "gateId": "real-x", "decision": "approve"}\n')
                f.write('{"type": "decision", "gateId": "real-z", "decision": "explode"}\n')
            got = {g["gateId"]: g["decision"] for g in B.decided_gates()}
            self.assertEqual(got.get("real-x"), "approve")
            self.assertNotIn("real-y", got)
            self.assertNotIn("real-z", got)
        finally:
            if existed:
                B.LEDGER.write_bytes(before)
                os.chmod(B.LEDGER, 0o600)
            else:
                B.LEDGER.unlink()



class FreshnessV84(unittest.TestCase):
    def test_held_target_refused_before_transport(self):
        op = FakeOpener([])
        f = B.Fub(creds_fn=lambda: {"FUB_API_KEY":"test"}, opener=op)
        for path, params in [("/people/99000001",None),("/people",{"id":"1,99000001"}),("/events",{"personId":"99000001"})]:
            with self.assertRaises(B.FubError): f.get(path,params)
        self.assertEqual(f.calls,0)

    def test_429_stops_all_following_calls_and_honors_long_retry(self):
        rate = urllib.error.HTTPError('http://test',429,'rate',{'Retry-After':'3600'},None)
        f=B.Fub(creds_fn=lambda:{"FUB_API_KEY":"test"},opener=FakeOpener([(lambda u:True,rate)]),sleeper=lambda _:None)
        with self.assertRaises(B.FubRateLimited) as e:f.get('/me')
        self.assertGreaterEqual(e.exception.wait,3600)
        with self.assertRaises(B.FubRateLimited):f.get('/events')
        self.assertEqual(f.calls,1)
        self.assertEqual(f.usage()['rateLimitedResponses'],1)

    def test_response_shape_is_checked(self):
        f=B.Fub(creds_fn=lambda:{"FUB_API_KEY":"test"},opener=FakeOpener([(lambda u:True,[])]),sleeper=lambda _:None)
        with self.assertRaises(B.FubError):f.get('/tasks')

    def test_pagination_rejects_wrong_collection(self):
        f=B.Fub(creds_fn=lambda:{"FUB_API_KEY":"test"},opener=FakeOpener([(lambda u:True,{'tasks':'bad'})]),sleeper=lambda _:None)
        with self.assertRaises(B.FubError):f.pages('/tasks',{},'tasks')

    def test_page_cap_is_never_current_data(self):
        f=B.Fub(creds_fn=lambda:{"FUB_API_KEY":"test"},opener=FakeOpener([(lambda u:True,{'tasks':[{'id':1}],'_metadata':{'next':'more'}})]),sleeper=lambda _:None)
        with self.assertRaises(B.FubError):f.pages('/tasks',{},'tasks',max_pages=1)

    def test_repeated_cursor_is_rejected(self):
        row={'tasks':[{'id':1}],'_metadata':{'next':'again'}}
        f=B.Fub(creds_fn=lambda:{"FUB_API_KEY":"test"},opener=FakeOpener([(lambda u:True,row),(lambda u:True,row)]),sleeper=lambda _:None)
        with self.assertRaises(B.FubError):f.pages('/tasks',{},'tasks')

    def test_offset_pagination_is_complete(self):
        f=B.Fub(creds_fn=lambda:{"FUB_API_KEY":"test"},opener=FakeOpener([(lambda u:'offset' not in u,{'tasks':[{'id':1}],'_metadata':{'total':2}}),(lambda u:'offset=1' in u,{'tasks':[{'id':2}],'_metadata':{'total':2}})]),sleeper=lambda _:None)
        self.assertEqual(len(f.pages('/tasks',{},'tasks')),2)

    def test_held_and_vendor_appointments_never_display(self):
        appts=[{'id':1,'title':'PRIVATE','start':'2026-11-01T16:00:00Z','invitees':[{'personId':99000001}]},
               {'id':2,'title':'VENDOR','start':'2026-11-01T16:00:00Z','invitees':[{'personId':40}]}]
        today=B.build_today([],appts,{},NOW,skip={40})
        self.assertFalse(today['events'])
        needs=B.build_needs([],appts,[],{40:{'id':40,'stage':'Trash'}},{},NOW)
        self.assertFalse(needs['items'])

    def test_missing_contact_appointment_does_not_escape_filter(self):
        a=[{'title':'PRIVATE','start':'2026-11-01T16:00:00Z','invitees':[{'personId':99}]}]
        n=B.build_needs([],a,[],{99:{'gone':True}},{},NOW)
        self.assertFalse(n['items'])

    def test_public_payload_redacts_other_phones(self):
        x=B.public_payload({'draft':['Call +1 (212) 555-0199 or 201-380-2010']})
        self.assertNotIn('555-0199',str(x));self.assertIn('201-380-2010',str(x))

    def test_payload_scrub_applies_before_snapshot(self):
        h=B.Hub();h.update('panel:x',{'text':'212-555-0199'})
        self.assertNotIn('555-0199',json.dumps(h.snapshot))

    def test_hot_sheet_expiry_follows_next_schedule(self):
        at=datetime(2026,11,1,12,10,tzinfo=timezone.utc)
        due=B.hotsheet_due(at)
        self.assertEqual((due.astimezone(ET).hour,due.astimezone(ET).minute),(7,35))
        self.assertFalse(B.hotsheet_overdue(at,due-timedelta(seconds=1)))
        self.assertTrue(B.hotsheet_overdue(at,due+timedelta(seconds=1)))

    def test_hot_sheet_early_dispatch_credits_only_nearby_nominal_slot(self):
        from unittest.mock import patch
        schedule_home=Path(TMP)/'hotsheet-schedule'
        schedule=schedule_home/'.codex/automations/studio-bco-njmls-hotsheet/automation.toml'
        schedule.parent.mkdir(parents=True,exist_ok=True)
        schedule.write_text('rrule="FREQ=DAILY;BYHOUR=7;BYMINUTE=5;BYSECOND=0"\n')
        cases=[
            ('2026-11-04T07:02:49-05:00','2026-11-05T07:35:00-05:00'),
            ('2026-11-04T07:00:00-05:00','2026-11-05T07:35:00-05:00'),
            ('2026-11-04T06:59:59-05:00','2026-11-04T07:35:00-05:00'),
            ('2026-11-04T07:05:00-05:00','2026-11-05T07:35:00-05:00'),
            ('2026-11-04T07:10:00-05:00','2026-11-05T07:35:00-05:00'),
            ('2026-10-31T07:02:00-04:00','2026-11-01T07:35:00-05:00'),
        ]
        with patch.object(B,'HOME',schedule_home):
            for pulled,expected in cases:
                with self.subTest(pulled=pulled):
                    at=datetime.fromisoformat(pulled);due=datetime.fromisoformat(expected)
                    self.assertEqual(B.hotsheet_due(at),due)
                    self.assertFalse(B.hotsheet_overdue(at,due-timedelta(seconds=1)))
                    self.assertTrue(B.hotsheet_overdue(at,due+timedelta(seconds=1)))
            schedule.write_text('rrule="FREQ=DAILY;BYHOUR=7,13;BYMINUTE=5;BYSECOND=0"\n')
            self.assertEqual(B.hotsheet_due(datetime.fromisoformat(cases[0][0])),
                             datetime.fromisoformat('2026-11-04T13:35:00-05:00'))

    def test_unchanged_hotsheet_is_rechecked_as_it_ages(self):
        from unittest.mock import patch
        p=Path(TMP)/'unchanged-hot.json';p.write_text(json.dumps({'rows':[],'generated_at':'2026-10-28T12:00:00Z'}))
        with patch.dict(B.CFG,{'hotsheet_paths':[p]}):
            w=B.HotSheetWatcher(B.Hub());w.tick();sig=w.sig
            with patch.object(B.time,'time',return_value=time.time()+61):w.tick()
            self.assertNotEqual(w.sig,sig);self.assertEqual(w.state['status'],'stale')

    def test_bad_hotsheet_preserves_last_rows_as_stale(self):
        from unittest.mock import patch
        p=Path(TMP)/'bad-hot.json';p.write_text(json.dumps({'rows':[]}))
        h=B.Hub()
        with patch.dict(B.CFG,{'hotsheet_paths':[p]}):
            w=B.HotSheetWatcher(h);w.tick();p.write_text('{bad');w.tick()
            self.assertEqual(h.snapshot['hotsheet']['status'],'stale')

    def test_each_market_has_expiry_and_own_date(self):
        items=[B.market_item('DGS10','Treasury','Bonds','pct',[(date(2026,10,30),4.0)]),
               B.market_item('MORTGAGE30US','Mortgage','Mortgage','pct',[(date(2026,10,29),6.0)])]
        t=B.build_ticker(items,datetime(2026,11,3,22,tzinfo=timezone.utc))
        self.assertTrue(t['items'][0]['stale']);self.assertFalse(t['items'][1]['stale'])
        self.assertNotEqual(t['items'][0]['asOf'],t['items'][1]['asOf']);self.assertEqual(t['status'],'stale')

    def test_daily_rate_weekend_does_not_false_alarm(self):
        i=B.market_item('DGS10','Treasury','Bonds','pct',[(date(2026,10,30),4.0)])
        t=B.build_ticker([i],NOW)
        self.assertFalse(t['items'][0]['stale'])

    def test_request_deadline_prevents_new_calls(self):
        f=B.Fub(creds_fn=lambda:{'FUB_API_KEY':'test'},opener=FakeOpener([]));f.deadline=time.monotonic()-1
        with self.assertRaises(B.FubError):f.get('/me')
        self.assertEqual(f.calls,0)

    def test_unchanged_probe_reuses_activity_without_full_fetch(self):
        f=FakeFub();p=B.FubPoller(f,B.Hub());sample,_=p.probe();p.cycle(sample,True)
        calls=f.calls;p.cycle(sample,False)
        self.assertEqual(f.calls,calls)

    def test_fub_error_also_marks_realscout_stale(self):
        h=B.Hub();p=B.FubPoller(FakeFub(),h);p.publish_problem(B.FubError('down'))
        self.assertEqual(h.feeds['realscout']['state'],'stale')

    def test_server_heartbeat_reports_release(self):
        meta=B.Hub().meta();self.assertEqual(meta['pageVersion'],'8.8.1');self.assertIn('serverTime',meta)


class ReleaseV84(unittest.TestCase):
    def test_text_collection_case_matches_live_api(self):
        f=B.Fub(creds_fn=creds,opener=FakeOpener([(lambda u:True,{'textmessages':[{'id':1}]})]),sleeper=lambda _:None)
        self.assertEqual(f.get('/textMessages')['textMessages'],[{'id':1}])

    def test_delta_watermark_is_before_source_reads(self):
        p=B.FubPoller(FakeFub(),B.Hub());sample,_=p.probe();p.cycle(sample,True)
        self.assertEqual(p.probe_since,sample['_checked_at'])
        self.assertEqual(p.last_ok,sample['_checked_at'])

    def test_failed_refresh_does_not_commit_fingerprint(self):
        from unittest.mock import patch
        p=B.FubPoller(FakeFub(),B.Hub());sample,_=p.probe()
        with patch.object(B,'build_feed',side_effect=B.FubError('bad payload')):
            with self.assertRaises(B.FubError):p.cycle(sample,True)
        self.assertIsNone(p.signature)

    def test_history_does_not_start_without_spare_time(self):
        p=B.FubPoller(FakeFub(),B.Hub());before=p.fub.calls
        self.assertFalse(p.history_step(NOW,time.monotonic()))
        self.assertEqual(p.fub.calls,before)

    def test_nyfed_asof_is_prior_business_day(self):
        i=B.market_item('SOFR','SOFR','Bonds','pct',[(date(2026,11,2),3.5)])
        self.assertEqual(B.market_due(i).astimezone(ET).date(),date(2026,11,4))


class PublicationCalendars(unittest.TestCase):
    def test_veterans_day_closure(self):
        self.assertEqual(B.next_market_day(date(2026,11,10),'DGS10'),date(2026,11,12))
    def test_thanksgiving_pmms_moves_to_wednesday(self):
        i={'id':'MORTGAGE30US','at':'2026-11-19T12:00:00Z'}
        self.assertEqual(B.market_due(i).date(),date(2026,11,25))
        i['at']='2026-11-25T12:00:00Z'
        self.assertEqual(B.market_due(i).date(),date(2026,12,3))
    def test_secured_and_unsecured_july_closures_differ(self):
        self.assertEqual(B.next_market_day(date(2026,7,2),'SOFR'),date(2026,7,6))
        self.assertEqual(B.next_market_day(date(2026,7,2),'DFF'),date(2026,7,3))
    def test_good_friday_exception(self):
        self.assertEqual(B.good_friday(2026),date(2026,4,3))
        self.assertEqual(B.next_market_day(date(2026,4,2),'SOFR'),date(2026,4,6))
        self.assertEqual(B.next_market_day(date(2026,4,2),'DGS10'),date(2026,4,3))
    def test_memorial_day(self):
        self.assertIn(date(2026,5,25),B.market_holidays(2026))
    def test_nonfinite_retry_is_bounded(self):
        op=FakeOpener([(lambda u:True,urllib.error.HTTPError('test',429,'rate',{'Retry-After':'NaN'},None))])
        f=B.Fub(creds_fn=creds,opener=op,sleeper=lambda _:None)
        with self.assertRaises(B.FubRateLimited) as e:f.get('/me')
        self.assertEqual(e.exception.wait,60)


class CounterSnapshot(unittest.TestCase):
    def test_wal_counts_without_touching_source_files(self):
        import sqlite3
        folder=Path(tempfile.mkdtemp(prefix='office-wal-'));db=folder/'ops.db'
        con=sqlite3.connect(db);con.execute('PRAGMA journal_mode=WAL');con.execute('CREATE TABLE events(ts TEXT,job TEXT,kind TEXT,ok INTEGER)');con.commit()
        con.execute('INSERT INTO events VALUES (?,?,?,?)',(B.iso_z(NOW),'com.beyderco.TEST','jobresult',1));con.commit()
        before={p.name:(p.read_bytes(),p.stat().st_mtime_ns) for p in folder.iterdir()}
        counts=B.runs_today(db,NOW)
        after={p.name:(p.read_bytes(),p.stat().st_mtime_ns) for p in folder.iterdir()}
        self.assertEqual(counts['com.beyderco.TEST']['ok'],1)
        self.assertEqual(before,after)
        con.execute('INSERT INTO events VALUES (?,?,?,?)',(B.iso_z(NOW),'com.beyderco.TEST','jobresult',1));con.commit()
        self.assertEqual(B.runs_today(db,NOW)['com.beyderco.TEST']['ok'],2)
        con.close()
    def test_future_receipt_never_counts_as_done(self):
        import sqlite3
        db=Path(TMP)/'future-ops.db';con=sqlite3.connect(db);con.execute('CREATE TABLE events(ts TEXT,job TEXT,kind TEXT,ok INTEGER)')
        con.execute('INSERT INTO events VALUES (?,?,?,?)',(B.iso_z(NOW+timedelta(days=1)),'com.beyderco.TEST','jobresult',1));con.commit();con.close()
        self.assertFalse(B.runs_today(db,NOW))
    def test_missing_identifier_is_partial_not_an_empty_current_panel(self):
        f=B.Fub(creds_fn=creds,opener=FakeOpener([(lambda u:True,{'tasks':[{}]})]),sleeper=lambda _:None)
        with self.assertRaises(B.FubError):f.pages('/tasks',{},'tasks')
    def test_new_assignment_receipt_is_replayable(self):
        from unittest.mock import patch
        p=Path(TMP)/'assignment-ledger.jsonl'
        with patch.object(B,'LEDGER',p):
            B.append_ledger({'type':'assign','assignmentId':'TEST-r1','agentId':'engineer','title':'TEST reminder','repeat':'daily'})
            with p.open('a') as legacy:legacy.write(json.dumps({'type':'assign','agentId':'engineer','title':'legacy'})+'\n')
            rows=B.saved_assignments();self.assertEqual(len(rows),1);self.assertEqual(rows[0]['assignmentId'],'TEST-r1')


class WireReliability(unittest.TestCase):
    def test_nonreading_client_cannot_stall_a_poller(self):
        a,b=socket.socketpair();a.setsockopt(socket.SOL_SOCKET,socket.SO_SNDBUF,4096)
        c=B.WSClient(a,'TEST');c.SEND_TIMEOUT=.1;t=time.monotonic()
        self.assertFalse(c.send_json({'TEST':'x'*500000}))
        self.assertLess(time.monotonic()-t,1)
        c.close();b.close()
    def test_nonfinite_api_number_is_rejected(self):
        f=B.Fub(creds_fn=creds,opener=FakeOpener([(lambda u:True,{'value':float('nan')})]),sleeper=lambda _:None)
        with self.assertRaises(B.FubError):f.get('/me')
    def test_health_expires_source_without_waiting_for_a_thread(self):
        h=B.Hub();h.set_feed('fub','ok',B.iso_z(NOW-timedelta(seconds=121)))
        self.assertEqual(h.feed_view(NOW)['fub']['state'],'stale')
        self.assertEqual(h.feeds['fub']['state'],'ok')
    def test_all_wire_messages_mask_aggregate_held_names(self):
        from unittest.mock import patch
        with patch.object(B,'HOLD_NAMES',{'TEST Private Name'}):
            self.assertNotIn('TEST Private Name',B.public_payload('TEST Private Name needs a call'))

class SecondAudit(unittest.TestCase):
    def test_lists_do_not_change_their_totals_at_display_cap(self):
        people={i:{"id":i,"firstName":"TEST", "lastName":str(i),"created":B.iso_z(NOW),"assignedUserId":1} for i in range(100,140)}
        tasks=[{"personId":i,"dueDate":"2026-11-01"} for i in people]
        appts=[{"start":"2026-11-01T18:00:00Z","title":"TEST"} for _ in range(10)]
        today=B.build_today(tasks,appts,{i:"TEST" for i in people},NOW)
        buyers=B.build_buyers(list(people.values()),[],people,[],NOW,1)
        self.assertEqual(len(buyers['newLeads']),40)
        self.assertEqual(len(today['events']),10)
        self.assertEqual(len(today['followups']['items']),40)
    def test_archived_closed_sales_count_but_open_archived_do_not(self):
        deals=[{"status":"Archived","stageName":"Sold","projectedCloseDate":"2026-10-01"},{"status":"Archived","stageName":"Listed"},{"status":"Deleted","stageName":"Sold","projectedCloseDate":"2026-10-01"}]
        p=B.build_pipeline(deals,[],NOW);self.assertEqual(p['stages']['closedYTD'],1);self.assertEqual(p['stages']['listings'],0)
        self.assertIn('projected',p['closedBasis'])
    def test_critical_dates_have_full_list(self):
        p=B.build_pipeline([{"stageName":"Listed","name":"TEST","projectedCloseDate":"2026-11-02"} for _ in range(12)],[],NOW)
        self.assertEqual(len(p['dates']),12)
    def test_vendor_variants_and_deleted_excluded(self):
        for p in [{"stage":"Vendor"},{"tags":["vendor solicitation"]},{"isDeleted":True},{"stage":"Deleted"}]:
            self.assertTrue(B._skip_person(1,p,set()))
        p={1:{"tags":["Vendor"]},2:{"firstName":"TEST"}}
        b=B.build_buyers([],[],p,[{"personId":1,"dueDate":"2026-10-01"},{"personId":2,"dueDate":"2026-10-01"}],NOW,1)
        self.assertEqual(b['overdue'],1)
    def test_unknown_appointment_contact_excluded_from_today(self):
        p=B.FubPoller(FakeFub(),B.Hub());sample,_=p.probe();now=datetime.now(timezone.utc)
        sample['appts']=[{"start":B.iso_z(now),"title":"TEST unknown","invitees":[{"personId":999999}]}]
        p.cycle(sample,True);self.assertEqual(p.last_panels['today']['events'],[])
    def test_draft_must_match_task_contact(self):
        p=B.FubPoller(FakeFub(),B.Hub())
        with self.assertRaises(B.FubError):p._notes_for([{"personId":2,"name":"Message Prep #55"}])
    def test_draft_budget_is_explicit_not_silent_partial(self):
        p=B.FubPoller(FakeFub(),B.Hub())
        with self.assertRaises(B.FubError):p._notes_for([{"personId":1,"name":"Message Prep #"+str(i)} for i in range(100,113)])
    def test_pid_replacement_resets_runtime(self):
        from unittest.mock import patch
        d=Path(tempfile.mkdtemp()); w=B.FleetWatcher(B.Hub(),runner=lambda:'PID Status Label\n2 0 com.beyderco.TEST',agents_dir=d,results_dir=d,db=d/'db')
        w.started['com.beyderco.TEST']=NOW-timedelta(hours=2);w.pids['com.beyderco.TEST']=1
        with patch.object(B,'runs_today',return_value={}),patch.object(Path,'exists',return_value=True):f=w.tick()
        self.assertEqual(f['agents'][f['jobs'][0]['agent']]['status'],'WORKING')
        self.assertGreater(w.started['com.beyderco.TEST'],NOW)
    def test_damaged_receipt_and_schedule_are_attention(self):
        d=Path(tempfile.mkdtemp());(d/'com.beyderco.TEST.json').write_text('{bad')
        r=B.read_results(d);self.assertIs(r['com.beyderco.TEST']['ok'],False)
        (d/'com.beyderco.TEST.plist').write_text('bad')
        w=B.FleetWatcher(B.Hub(),agents_dir=d);w._load_schedules()
        self.assertIn('error',w.schedules['com.beyderco.TEST'])
    def test_future_outcome_cannot_be_a_success(self):
        label='com.beyderco.TEST';f=B.build_fleet({label:{'pid':None,'exit':0}},{},{label:{'ok':True,'generated_at':B.iso_z(NOW+timedelta(days=1))}},{},{},NOW)
        self.assertIs(f['jobs'][0]['ok'],False);self.assertIsNone(f['jobs'][0]['lastAt'])


class LocalDiagnostics(unittest.TestCase):
    def test_metrics_allowlist_rejects_text_and_nonfinite_values(self):
        h=B.Hub();h.record_runtime(object(),{'errors':0,'renderFps':22,'heapBytes':float('nan'),'secret':'TEST not allowed','panels':{'today':{'status':'live','ageSeconds':30,'name':'TEST not allowed'}}})
        row=h.runtime_view()[0];self.assertEqual(row['renderFps'],22)
        self.assertNotIn('heapBytes',row);self.assertNotIn('secret',row);self.assertNotIn('TEST not allowed',json.dumps(row))


class RuntimeDisconnect(unittest.TestCase):
    def test_closed_page_metrics_are_removed(self):
        class Client:
            def close(self):pass
        c=Client();h=B.Hub();h.record_runtime(c,{'errors':1});h.remove(c);self.assertEqual(h.runtime_view(),[])


class PackagingGuards(unittest.TestCase):
    def test_artifact_and_stale_page_are_refused(self):
        import build_installer as I
        p=Path(TMP)/'wrong-page.html';out=Path(TMP)/'bad-installer.command'
        for data in ['<script>window.BCO_ARTIFACT=true;</script>','<!doctype html><script>window.BCO_BUILD="00000000000000000000";</script>']:
            p.write_text(data)
            with self.assertRaises(ValueError):I.main([str(p),str(out)])
            self.assertFalse(out.exists())
    def test_fleet_label_is_refused_explicitly(self):
        import build_installer as I
        with self.assertRaises(ValueError):I.main(['unused','unused','--label','com.beyderco.TEST'])


class FinalSweep(unittest.TestCase):
    def test_activity_day_count_precedes_display_cap(self):
        tx=[{'id':i,'personId':1,'sent':B.iso_z(NOW)} for i in range(80)]
        out=B.build_feed([],[],tx,[],[],{1:{'firstName':'TEST'}},NOW)
        self.assertEqual(out['day'],80);self.assertEqual(len(out['items']),60)
    def test_unrecognized_or_future_hotsheet_is_not_current(self):
        for d in [{'unexpected':True},{'rows':[],'generated_at':B.iso_z(NOW+timedelta(days=1))}]:
            self.assertEqual(B.build_hotsheet(d,{},set(),NOW,NOW.timestamp())['status'],'error')
    def test_valid_empty_hotsheet_is_current(self):
        self.assertEqual(B.build_hotsheet({'schema':'bco.njmls_hotsheet/v1','groups':{},'generated_at':B.iso_z(NOW)}, {},set(),NOW,NOW.timestamp())['status'],'live')


class OpenHouseClock(unittest.TestCase):
    def test_open_house_dates_and_ranges_use_eastern_12hour(self):
        self.assertEqual(B.fmt_open_time('2026-11-03T19:00:00Z'),'Nov 3, 2:00 PM ET')
        self.assertEqual(B.fmt_open_time('14:00–16:00'),'2:00 PM–4:00 PM')
        self.assertEqual(B.fmt_open_time('2:00 PM–4:00 PM'),'2:00 PM–4:00 PM')
        self.assertEqual(B.fmt_open_time('2026-11-03T14:00:00'),'Nov 3, 2:00 PM ET')


class CompleteDraft(unittest.TestCase):
    def test_prepared_draft_is_not_cut_at_700_characters(self):
        body='TEST complete prepared draft. '*100
        tasks=[{'id':1,'personId':1,'name':'Message Prep #55','dueDate':'2026-11-01'}]
        n=B.build_needs(tasks,[],[],{1:{'firstName':'TEST'}},{55:{'body':body}},NOW)
        self.assertEqual(n['items'][0]['draft'],body.strip())
        self.assertGreater(len(n['items'][0]['draft']),700)


class ContextBudgetLead(unittest.TestCase):
    def test_history_starts_with_room_to_finish_before_stale_deadline(self):
        from unittest.mock import patch
        p=B.FubPoller(FakeFub(),B.Hub());p.history['at']=time.time()-1560
        with patch.object(p,'_scan_history',return_value=iter([None])) as scan:
            self.assertTrue(p.history_step(NOW,time.monotonic()+30));scan.assert_called_once()
        p.history['at']=time.time()-1200
        with patch.object(p,'_scan_history') as scan:
            self.assertFalse(p.history_step(NOW,time.monotonic()+30));scan.assert_not_called()


class SourceRecoveryCadence(unittest.TestCase):
    def test_repeated_api_faults_retry_within_one_minute_then_recover(self):
        from unittest.mock import patch
        class Stop:
            def __init__(self):self.waits=[]
            def is_set(self):return len(self.waits)>=3
            def wait(self,seconds):self.waits.append(seconds);return self.is_set()
        for fault in (B.FubError('TEST network failure'),RuntimeError('TEST bad payload')):
            p=B.FubPoller(FakeFub(),B.Hub());stop=Stop()
            def cycle(*args,**kwargs):p.last_ok=datetime.now(timezone.utc)
            with patch.object(p,'probe',side_effect=[fault,fault,({},True)]),patch.object(p,'cycle',side_effect=cycle),patch.object(p,'history_step',return_value=False):p.run(stop)
            self.assertTrue(all(0<w<=60 for w in stop.waits));self.assertEqual(p.hub.feeds['fub']['state'],'ok')


class BackendV85(unittest.TestCase):
    def fresh_hub(self):
        h=B.Hub();now=datetime.now(timezone.utc)
        h.snapshot['ticker']={'items':[{'at':now.astimezone(ET).date().isoformat(),'staleAfter':(now.timestamp()+3600)*1000,'stale':False}]}
        h.snapshot['hotsheet']={'staleAfter':(now.timestamp()+3600)*1000}
        for name in h.feeds:h.set_feed(name,'ok',B.iso_z(now))
        return h,now

    def test_readiness_distinguishes_attention_startup_and_liveness(self):
        h=B.Hub();self.assertEqual(h.readiness()['status'],'starting');self.assertFalse(h.readiness()['ready'])
        h.set_feed('fub','auth',None,'TEST secret');self.assertEqual(h.readiness()['status'],'degraded')
        h,now=self.fresh_hub();self.assertTrue(h.readiness()['ready'])
        h.set_feed('fleet','attention',B.iso_z(now),'TEST source failure')
        ready=h.readiness();self.assertFalse(ready['ready']);self.assertTrue(ready['dataAvailable']);self.assertEqual(ready['attention'],['fleet'])

    def test_future_or_missing_source_time_never_claims_current(self):
        h,now=self.fresh_hub()
        for stamp in (None,'invalid',B.iso_z(now+timedelta(minutes=10))):
            h.set_feed('fub','ok',stamp)
            row=h.feed_view(now)['fub'];self.assertEqual(row['state'],'stale');self.assertEqual(row['reason'],'invalid_timestamp')
            self.assertIsNone(row['ageSeconds'])

    def test_rate_fetch_and_publication_have_separate_expiry(self):
        h,now=self.fresh_hub();h.feeds['rates']['asOf']=B.iso_z(now-timedelta(seconds=1801))
        self.assertEqual(h.feed_view(now)['rates']['reason'],'check_overdue')
        h.feeds['rates']['asOf']=B.iso_z(now);h.snapshot['ticker']['items'][0]['staleAfter']=(now.timestamp()-1)*1000
        self.assertEqual(h.feed_view(now)['rates']['reason'],'publication_overdue')
        h.snapshot['ticker']['items'][0]['staleAfter']=float('nan')
        self.assertEqual(h.feed_view(now)['rates']['state'],'stale')

    def test_future_market_observation_and_missing_hot_deadline_are_stale(self):
        h,now=self.fresh_hub();h.snapshot['ticker']['items'][0]['at']=B.iso_z(now+timedelta(days=2));h.snapshot['hotsheet']={}
        self.assertEqual(h.feed_view(now)['rates']['state'],'stale')
        self.assertEqual(h.feed_view(now)['hotsheet']['reason'],'invalid_deadline')

    def test_diagnostics_history_is_bounded_sanitized_and_tracks_expiry(self):
        h,now=self.fresh_hub()
        h.set_feed('fub','error','TEST private timestamp','TEST confidential source detail')
        d=h.diagnostics();self.assertNotIn('TEST',json.dumps(d));self.assertIsNone(d['feeds']['fub']['asOf'])
        for n in range(140):h.set_feed('fub','error' if n%2 else 'ok',B.iso_z(now),'TEST hidden note')
        self.assertEqual(len(h.transitions),120)
        h.set_feed('fub','ok',B.iso_z(now));h.feed_view(now+timedelta(seconds=121))
        self.assertEqual([t for t in h.transitions if t['feed']=='fub'][-1]['reason'],'check_overdue')
        before=len(h.transitions);h.feed_view(now+timedelta(seconds=122));self.assertEqual(len(h.transitions),before)
        self.assertNotIn('note',d['feeds']['fub'])

    def test_diagnostics_rejects_unknown_feed_and_runtime_identity_text(self):
        h=B.Hub()
        with self.assertRaises(ValueError):h.set_feed('TEST private customer','ok')
        h.record_runtime(object(),{'buildId':'TEST secret','errors':0})
        self.assertIsNone(h.runtime_view()[0]['buildId'])

    def test_endpoint_metrics_strip_identifiers_queries_and_unknown_headers(self):
        class Opener:
            def open(self,req,timeout):
                response=FakeResp(b'{}');response.headers={'X-RateLimit-Context':'TEST secret','X-RateLimit-Remaining':'9','X-RateLimit-Limit':'10','X-RateLimit-Window':'10'};return response
        f=B.Fub(creds_fn=creds,opener=Opener(),sleeper=lambda _:None)
        f.get('/people/999999',{'email':'TEST secret'})
        f.get('/TEST-secret/999999')
        out=f.usage();self.assertEqual(set(out['endpoints']),{'people','other'})
        self.assertNotIn('999999',json.dumps(out));self.assertNotIn('TEST',json.dumps(out))
        self.assertEqual(out['endpoints']['people']['requests'],1);self.assertEqual(out['endpoints']['people']['failures'],0)
        self.assertGreaterEqual(out['endpoints']['people']['meanLatencyMs'],0)

    def test_successful_reserve_hold_is_distinct_from_http429(self):
        class Opener:
            def open(self,req,timeout):
                response=FakeResp(b'{}');response.headers={'X-RateLimit-Context':'notes','X-RateLimit-Remaining':'1','X-RateLimit-Limit':'10','X-RateLimit-Window':'10'};return response
        f=B.Fub(creds_fn=creds,opener=Opener(),sleeper=lambda _:None);f.get('/notes/99')
        with self.assertRaises(B.FubRateLimited) as e:f.get('/events')
        self.assertEqual(e.exception.reason,'reserve');out=f.usage()
        self.assertEqual(out['reservePauses'],1);self.assertEqual(out['rateLimitedResponses'],0);self.assertEqual(out['endpoints']['notes']['failures'],0)
        self.assertEqual(out['cooldown']['reason'],'reserve');self.assertEqual(out['callsTotal'],1)
        p=B.FubPoller(f,B.Hub());p.publish_problem(e.exception)
        self.assertIn('preserving shared API quota',p.hub.feeds['fub']['note'])

    def test_failure_and_http429_latency_counters(self):
        f=B.Fub(creds_fn=creds,opener=FakeOpener([(lambda u:True,urllib.error.HTTPError('TEST',429,'TEST',{'Retry-After':'65'},None))]),sleeper=lambda _:None)
        with self.assertRaises(B.FubRateLimited) as e:f.get('/events')
        self.assertEqual(e.exception.reason,'http429');out=f.usage()
        self.assertEqual(out['endpoints']['events']['http429'],1);self.assertEqual(out['endpoints']['events']['failures'],1)
        self.assertEqual(out['cooldown']['reason'],'http429');self.assertEqual(out['reservePauses'],0)
        f=B.Fub(creds_fn=creds,opener=FakeOpener([(lambda u:True,urllib.error.URLError('TEST'))]),sleeper=lambda _:None)
        with self.assertRaises(B.FubError):f.get('/people')
        self.assertEqual(f.usage()['endpoints']['people']['failures'],1)

    def test_concurrent_usage_sampling_does_not_race_expired_queue(self):
        f=B.Fub(creds_fn=creds,opener=FakeOpener([]),clock=lambda:10000)
        f.request_times.extend(range(100));errors=[]
        def sample():
            try:
                for _ in range(100):self.assertEqual(f.usage()['callsLastHour'],0)
            except Exception as e:errors.append(e)
        threads=[threading.Thread(target=sample) for _ in range(8)]
        for t in threads:t.start()
        for t in threads:t.join()
        self.assertFalse(errors)

    def test_ledger_serializes_duplicate_receipts_and_fsyncs(self):
        from unittest.mock import patch
        p=Path(TMP)/'v85-concurrent.jsonl';p.unlink(missing_ok=True)
        entry={'type':'assign','assignmentId':'TEST-same','agentId':'engineer','title':'TEST reminder','repeat':'once'}
        results=[];errors=[]
        def write():
            try:results.append(B.append_ledger(entry))
            except Exception as e:errors.append(e)
        with patch.object(B,'LEDGER',p),patch.object(B.os,'fsync',wraps=os.fsync) as sync:
            threads=[threading.Thread(target=write) for _ in range(8)]
            for t in threads:t.start()
            for t in threads:t.join()
            self.assertFalse(errors);self.assertEqual(results.count(True),1);self.assertEqual(len(p.read_text().splitlines()),1);self.assertEqual(sync.call_count,len(results))
            with self.assertRaises(ValueError):B.append_ledger(dict(entry,title='TEST changed'))
            self.assertEqual(len(B.saved_assignments()),1)

    def test_empty_held_name_set_preserves_operational_receipts(self):
        from unittest.mock import patch
        d=Path(tempfile.mkdtemp(dir=TMP));(d/'agents').mkdir();(d/'results').mkdir();(d/'counter.db').touch()
        path=d/'results/com.beyderco.monitor.json'
        private_summary='TEST intake stopped: property_evidence_stale; no writes'
        h=B.Hub();messages=[]
        class Client:
            def send_json(self,message):messages.append(message);return True
        h.clients.add(Client())
        w=B.FleetWatcher(h,runner=lambda:'PID Status Label\n- 0 com.beyderco.monitor',agents_dir=d/'agents',results_dir=d/'results',db=d/'counter.db')
        expected=private_summary
        with patch.object(B,'HOLD_NAMES',set()),patch.object(B,'runs_today',return_value={}):
            for offset in (0,1):
                receipt={'job':'com.beyderco.monitor','ok':False,'summary':private_summary,'generated_at':B.iso_z(datetime.now(timezone.utc)+timedelta(seconds=offset))}
                path.write_text(json.dumps(receipt))
                fleet=w.tick()
                self.assertEqual(fleet['jobs'][0]['summary'],expected)
                self.assertNotIn('starting',fleet['jobs'][0]['summary'])
                self.assertIn(private_summary,json.dumps(fleet))
                self.assertTrue(any(m.get('type')=='fleet' and private_summary in json.dumps(m) for m in messages))
                self.assertTrue(any(m.get('type')=='status' and 'property_evidence_stale' in m.get('detail','') for m in messages))
                self.assertEqual(json.loads(path.read_text()),receipt)
        self.assertTrue(any(m.get('type')=='log' and expected in m.get('text','') for m in messages))

    def test_receipt_retry_after_fsync_failure_requires_new_durability_barrier(self):
        from unittest.mock import patch
        p=Path(TMP)/'v85-fsync-retry.jsonl';p.unlink(missing_ok=True)
        entry={'type':'assign','assignmentId':'TEST-retry','agentId':'engineer','title':'TEST durable receipt','repeat':'once'}
        with patch.object(B,'LEDGER',p),patch.object(B.os,'fsync',side_effect=[OSError('TEST disk failure'),None]) as sync:
            with self.assertRaises(OSError):B.append_ledger(entry)
            self.assertFalse(B.append_ledger(entry))
            self.assertEqual(sync.call_count,2)
            self.assertEqual(len(p.read_text().splitlines()),1)
        with patch.object(B,'LEDGER',p),patch.object(B.os,'fsync',side_effect=OSError('TEST still failing')):
            with self.assertRaises(OSError):B.append_ledger(entry)

    def test_market_refresh_publishes_observations_before_healthy_metadata(self):
        from unittest.mock import patch
        # A first full fetch and recovery from an error must never observe the
        # absent/expired old ticker after the source has been marked healthy.
        for prior in ('starting','error'):
            h=B.Hub();h.set_feed('rates',prior)
            if prior=='error':
                h.snapshot['ticker']={'items':[{'at':'2000-01-01','stale':True,'staleAfter':0}]}
            h.transitions.clear();now=datetime.now(timezone.utc)
            observation=now.astimezone(ET).date()
            got={sid:[(observation,4.0)] for sid,*_ in B.MARKET_SERIES}
            p=B.MarketsPoller(hub=h,pause=0)
            def publish():
                self.assertEqual(p.state,'ok')
                h.update('ticker',B.build_ticker(p.latest,now,status='stale' if p.state=='error' else 'live'))
                h.feed_view(now)  # concurrent diagnostics during publication
            p.on_update=publish
            with patch.object(p,'collect',return_value=got):p.refresh()
            self.assertEqual(h.snapshot['bridge']['feeds']['rates']['state'],'ok')
            states=[row['to'] for row in h.transitions if row['feed']=='rates']
            self.assertEqual(states,['ok'])
            self.assertEqual(h.snapshot['ticker']['status'],'live')

    def test_ledger_refuses_invalid_actions_and_fub_gate_decisions(self):
        from unittest.mock import patch
        p=Path(TMP)/'v85-invalid.jsonl';p.unlink(missing_ok=True)
        with patch.object(B,'LEDGER',p):
            for entry in ({'type':'assign','agentId':'engineer','title':'TEST'},
                          {'type':'assign','assignmentId':'TEST','agentId':'engineer','title':'','repeat':'once'},
                          {'type':'assign','assignmentId':'TEST','agentId':'engineer','title':'TEST','repeat':'hourly'},
                          {'type':'decision','agentId':'engineer','gateId':'fub-task-123','decision':'approve'},
                          {'type':'decision','agentId':'engineer','gateId':'TEST','decision':'send'}):
                with self.assertRaises(ValueError):B.append_ledger(entry)
            self.assertFalse(p.exists())

    def test_torn_ledger_tail_does_not_swallow_next_valid_receipt(self):
        from unittest.mock import patch
        p=Path(TMP)/'v85-torn.jsonl';p.write_bytes(b'{"type":"assign","title":"torn\xe2')
        with patch.object(B,'LEDGER',p):
            self.assertTrue(B.append_ledger({'type':'assign','assignmentId':'TEST-torn','agentId':'engineer','title':'TEST → unicode','repeat':'weekly'}))
            self.assertEqual(B.saved_assignments()[0]['title'],'TEST → unicode')
            self.assertTrue(p.read_bytes().startswith(b'{"type":"assign","title":"torn\xe2\n'))

    def test_invalid_ledger_request_gets_explicit_ack_without_writing(self):
        from unittest.mock import patch
        class Client:
            def __init__(self):self.messages=[]
            def send_json(self,m):self.messages.append(m)
        c=Client()
        with patch.object(B,'append_ledger',side_effect=ValueError('TEST invalid')):
            B.handle_client_message(json.dumps({'type':'assign','assignmentId':'TEST'}),c)
        self.assertEqual(c.messages[0]['recorded'],False);self.assertEqual(c.messages[0]['reason'],'invalid_receipt')


class BackendHTTPV85(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from unittest.mock import patch
        cls.folder=Path(tempfile.mkdtemp(dir=TMP));cls.html=cls.folder/'office.html';cls.html.write_bytes(b'TEST first page')
        (cls.folder/'vendor/fonts').mkdir(parents=True);(cls.folder/'vendor/fonts/test.woff2').write_bytes(b'TEST font')
        cls.port=_free_port();cls.patches=[patch.object(B,'OFFICE_HTML',cls.html),patch.object(B,'APP_DIR',cls.folder),patch.object(B,'HUB',B.Hub()),patch.object(B,'FUB_CLIENT',None),patch.dict(B.CFG,{'port':cls.port})]
        for p in cls.patches:p.start()
        cls.server=B.Server(('127.0.0.1',cls.port),B.Handler);threading.Thread(target=cls.server.serve_forever,daemon=True).start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close()
        for p in reversed(cls.patches):p.stop()
    def request(self,path='/',method='GET',headers=None):
        import http.client
        c=http.client.HTTPConnection('127.0.0.1',self.port,timeout=3);c.request(method,path,headers=headers or {});r=c.getresponse();out=(r.status,dict(r.getheaders()),r.read());c.close();return out
    def test_etag_revalidation_and_replaced_release(self):
        first=self.request();self.assertEqual(first[0],200);tag=first[1]['ETag'];self.assertIn('no-cache',first[1]['Cache-Control'])
        cached=self.request(headers={'If-None-Match':tag});self.assertEqual((cached[0],cached[2]),(304,b''))
        self.html.write_bytes(b'TEST updated page')
        updated=self.request(headers={'If-None-Match':tag});self.assertEqual((updated[0],updated[2]),(200,b'TEST updated page'));self.assertNotEqual(updated[1]['ETag'],tag)
    def test_font_head_and_weak_conditional_tag(self):
        first=self.request('/vendor/fonts/test.woff2');head=self.request('/vendor/fonts/test.woff2','HEAD')
        self.assertEqual(head[2],b'');self.assertEqual(first[1]['ETag'],head[1]['ETag'])
        weak=self.request('/vendor/fonts/test.woff2',headers={'If-None-Match':'W/'+first[1]['ETag']});self.assertEqual(weak[0],304)
        self.assertEqual(self.request('/vendor/../../private/decisions.jsonl')[0],404)
    def test_diagnostics_and_health_are_private_uncached_and_truthful(self):
        health=self.request('/health');data=json.loads(health[2]);self.assertTrue(data['ok']);self.assertFalse(data['readiness']['ready'])
        diag=self.request('/diagnostics');d=json.loads(diag[2]);self.assertEqual(diag[1]['Cache-Control'],'no-store');self.assertIn('transitions',d)
        self.assertNotIn('snapshot',d);self.assertNotIn('note',json.dumps(d));self.assertEqual(d['version'],'1.6.0')
        self.assertEqual(self.request('/diagnostics',headers={'Host':'evil.example'})[0],403)


if __name__ == "__main__":
    unittest.main(verbosity=1)
