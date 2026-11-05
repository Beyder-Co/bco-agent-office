#!/usr/bin/env python3
"""A tiny stand-in for the Follow Up Boss API, for end-to-end tests of the bridge. Synthetic people only."""
import json
import os
import time
import sys
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

try:
    from zoneinfo import ZoneInfo
    ET = ZoneInfo("America/New_York")
except Exception:
    ET = timezone(timedelta(hours=-5))


def z(dt):
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def data():
    now = datetime.now(timezone.utc)
    today = now.astimezone(ET).date()
    d = lambda n: (today + timedelta(days=n)).isoformat()
    at_et = lambda n_days, h, m=0: z(datetime(today.year, today.month, today.day, h, m, tzinfo=ET) + timedelta(days=n_days))
    people = {
        101: ("Avery", "Stone", "Buyer-Engaged", 88), 102: ("Jordan", "Price", "Seller-Engaged", None),
        103: ("Morgan", "Hale", "Buyer-Nurture", 61), 104: ("Riley", "Brooks", "Buyer-Engaged", 93),
        105: ("Casey", "Lund", "Lead", None), 106: ("Taylor", "Quinn", "Buyer-Engaged", 47),
        107: ("Sam", "Ortiz", "Lead", None), 108: ("Drew", "Kim", "Seller-Nurture", None),
    }
    tasks = [
        {"id": 9001, "personId": 101, "type": "Call", "name": "Call", "dueDate": d(0), "dueDateTime": at_et(0, 11), "isCompleted": 0, "assignedUserId": 1},
        {"id": 9002, "personId": 102, "type": "Email", "name": "Email", "dueDate": d(0), "dueDateTime": at_et(0, 14, 30), "isCompleted": 0, "assignedUserId": 1},
        {"id": 9003, "personId": 103, "type": "Text", "name": "Text", "dueDate": d(-2), "dueDateTime": at_et(-2, 10), "isCompleted": 0, "assignedUserId": 1},
        {"id": 9004, "personId": 108, "type": "Call", "name": "Call", "dueDate": d(-6), "dueDateTime": at_et(-6, 9), "isCompleted": 0, "assignedUserId": 1},
        {"id": 9005, "personId": 104, "type": "Call", "name": "Call", "dueDate": d(3), "dueDateTime": at_et(3, 9), "isCompleted": 0, "assignedUserId": 1},
        {"id": 9006, "personId": 104, "type": "Text", "name": "✋ SEND TEXT: Discuss 61 Mac Arthur Ave — Message Prep #7001", "dueDate": d(0), "isCompleted": 0, "assignedUserId": 1},
        {"id": 9007, "personId": 0, "type": "Follow Up", "name": "Refresh NJMLS Matrix login — seed funnel paused", "dueDate": d(0), "isCompleted": 0, "assignedUserId": 1},
    ]
    appts = [
        {"id": 501, "title": "Showing with Avery Stone", "start": at_et(0, 13), "end": at_et(0, 14), "location": "46 Overlook Rd, Alpine, NJ 07620",
         "invitees": [{"userId": 1, "name": "Igor Beyder"}, {"personId": 101, "name": "Avery Stone"}]},
        {"id": 502, "title": "Listing appointment", "start": at_et(0, 16, 30), "end": at_et(0, 17), "location": "9 Oak Ln, Demarest, NJ"},
        {"id": 503, "title": "Next week", "start": at_et(7, 10), "end": at_et(7, 11)},
    ]
    deals = [
        {"id": 1, "name": "46 Overlook Rd, Alpine, NJ", "pipelineName": "Sellers", "stageId": 20, "stageName": "Listed / Active", "price": 4250000,
         "customExpirationDate": d(9) + "T00:00:00Z"},
        {"id": 2, "name": "3 Highwood Pl, Closter, NJ", "pipelineName": "Sellers", "stageId": 24, "stageName": "UNDER CONTRACT", "price": 2650000,
         "projectedCloseDate": d(18) + "T00:00:00Z", "finalWalkThroughDate": d(12) + "T00:00:00Z"},
        {"id": 3, "name": "9 Oak Ln, Demarest, NJ", "pipelineName": "Sellers", "stageId": 22, "stageName": "ARIP", "price": 1980000,
         "dueDiligenceDate": d(2) + "T00:00:00Z", "earnestMoneyDueDate": d(4) + "T00:00:00Z"},
        {"id": 4, "name": "Buyer search, Haworth", "pipelineName": "Buyers", "stageId": 21, "stageName": "Offer", "price": 1750000},
        {"id": 5, "name": "1 Hill Rd, Alpine, NJ", "pipelineName": "Sellers", "stageId": 34, "stageName": "OFF-MARKET", "price": 6900000},
        {"id": 6, "name": "12 Elm St, Closter, NJ", "pipelineName": "Sellers", "stageId": 26, "stageName": "CLOSED", "price": 1890000,
         "projectedCloseDate": f"{today.year}-03-14T00:00:00Z"},
    ]
    ev = lambda i, pid, typ, hours, street, city, mls, price: {
        "id": i, "personId": pid, "type": typ, "source": "RealScout", "occurred": z(now - timedelta(hours=hours)),
        "property": {"street": street, "city": city, "mlsNumber": mls, "price": price}}
    events = [
        ev(1, 104, "Viewed Property", 2, "61 Mac Arthur Ave", "Closter", "26030461", "3448800"),
        ev(2, 104, "Viewed Property", 5, "61 Mac Arthur Ave", "Closter", "26030461", "3448800"),
        ev(3, 104, "Saved Property", 6, "61 Mac Arthur Ave", "Closter", "26030461", "3448800"),
        ev(4, 106, "Viewed Property", 20, "29 Roslyn Ave", "Englewood Cliffs", "26017457", "2888000"),
        ev(5, 106, "Viewed Property", 26, "5 Oak Ln", "Demarest", "26099999", "2100000"),
        ev(6, 101, "Property Inquiry", 30, "46 Overlook Rd", "Alpine", "26011111", "4250000"),
        ev(7, 103, "Viewed Property", 40, "61 Mac Arthur Ave", "Closter", "26030461", "3448800"),
        ev(8, 107, "Viewed Page", 3, "", "", "", ""),
    ]
    recent = [
        {"id": 105, "created": z(now - timedelta(hours=5)), "firstName": "Casey", "lastName": "Lund", "stage": "Lead", "source": "beyderco.com", "assignedUserId": 1, "tags": ["Website Inquiry"]},
        {"id": 107, "created": z(now - timedelta(days=2)), "firstName": "Sam", "lastName": "Ortiz", "stage": "Lead", "source": "RealScout", "assignedUserId": 1, "tags": []},
        {"id": 110, "created": z(now - timedelta(days=1)), "firstName": "Vendor", "lastName": "Pitch", "stage": "Lead", "source": "beyderco.com", "assignedUserId": 1, "tags": ["Vendor Solicitation"]},
    ]
    pipelines = [{"id": 2, "name": "Sellers", "stages": [{"id": 20, "name": "Listed / Active"}, {"id": 26, "name": "CLOSED", "closedStage": True}]},
                 {"id": 1, "name": "Buyers", "stages": [{"id": 25, "name": "SOLD", "closedStage": True}]}]
    em = [{"id": 1, "personId": 106, "type": "click", "count": 2, "subject": "Just listed in Closter", "created": z(now - timedelta(hours=9)), "updated": z(now - timedelta(hours=4))},
          {"id": 2, "personId": 103, "type": "open", "count": 1, "subject": "Market brief", "created": z(now - timedelta(hours=30)), "updated": z(now - timedelta(hours=30))}]
    texts = [{"id": 1, "personId": 104, "isIncoming": True, "message": "Can we see it Saturday?", "fromNumber": "+12015550104", "toNumber": "+12015550100", "sent": z(now - timedelta(hours=1))},
             {"id": 2, "personId": 104, "isIncoming": False, "message": "Saturday at 11 works.", "fromNumber": "+12015550100", "toNumber": "+12015550104", "sent": z(now - timedelta(minutes=50))}]
    notes = {7001: {"id": 7001, "personId": 104, "subject": "Message Prep", "body": "<p>Hi Riley,</p><p>Saturday at 11 at 61 Mac Arthur Ave works. See you there.</p>"}}
    notes[7001]["body"] += "<p>" + "TEST complete source draft. " * 100 + "TEST FINAL PARAGRAPH</p>"
    return people, tasks, appts, deals, events, recent, pipelines, em, texts, notes


DATA = data()
MODE = "ok"
REQUESTS = []
DONE: set = set()  # test-only: tasks "completed in Follow Up Boss" via GET /__complete?id=


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        global MODE
        people, tasks, appts, deals, events, recent, pipelines, em, texts, notes = DATA
        u = urlsplit(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        path = u.path.replace("/v1", "", 1)
        if path == "/__mode":
            MODE = q.get("mode", "ok")
        REQUESTS.append({"path": path, "at": time.time()})
        if not path.startswith("/__") and MODE in ("down", "rate"):
            self.send_response(429 if MODE == "rate" else 503)
            self.send_header("Retry-After", "65")
            self.send_header("Content-Length", "0"); self.end_headers(); return
        if not path.startswith("/__") and MODE == "slow":
            time.sleep(10)
        if not path.startswith("/__") and MODE == "bad":
            raw=b"{bad"; self.send_response(200); self.send_header("Content-Length",str(len(raw))); self.end_headers(); self.wfile.write(raw); return
        meta = {"next": "again" if MODE == "partial" else None}
        if path == "/__mode":
            body = {"ok": True, "mode": MODE}
        elif path == "/__requests":
            body = {"requests": REQUESTS[-300:]}
        elif path == "/__complete" and q.get("id", "").isdigit():
            DONE.add(int(q["id"]))
            body = {"ok": True, "done": sorted(DONE)}
        elif path == "/me":
            body = {"id": 1, "isOwner": True, "role": "admin", "outboundNumber": "+12015550100"}
        elif path == "/identity":
            body = {"account": {"domain": "beyderco"}}
        elif path == "/emEvents":
            body = {"emEvents": em}
        elif path == "/textMessages":
            if q.get("fromNumber"):
                body = {"textMessages": [t for t in texts if t["fromNumber"] == q["fromNumber"]]}
            elif q.get("toNumber"):
                body = {"textMessages": [t for t in texts if t["toNumber"] == q["toNumber"]]}
            else:
                self.send_response(400)
                self.end_headers()
                return
        elif path.startswith("/notes/") and path[7:].isdigit() and int(path[7:]) in notes:
            body = dict(notes[int(path[7:])])
        elif path == "/pipelines":
            body = {"pipelines": pipelines}
        elif path == "/tasks":
            for t in tasks:
                if t["id"] in DONE:
                    t["isCompleted"] = 1
            if q.get("isCompleted") == "false":
                tasks = [t for t in tasks if not t["isCompleted"]]
            body = {"tasks": tasks}
        elif path == "/appointments":
            body = {"appointments": appts}
        elif path == "/deals":
            body = {"deals": deals}
        elif path == "/events":
            body = {"events": events}
        elif path == "/people" and q.get("id"):
            ids = [int(x) for x in q["id"].split(",") if x]
            body = {"people": [{"id": i, "firstName": people[i][0], "lastName": people[i][1], "stage": people[i][2],
                                "customRealScoutScoutScore": people[i][3], "tags": []} for i in ids if i in people]}
        elif path == "/people":
            all_people = [{"id":i,"firstName":p[0],"lastName":p[1],"stage":p[2],"customRealScoutScoutScore":p[3],"tags":[]}
                          for i,p in people.items()]
            all_people += [p for p in recent if p["id"] not in people]
            body = {"people": all_people, "_metadata": {"total":len(all_people),"next":meta["next"]}}
        else:
            self.send_response(404)
            self.end_headers()
            return
        if path == "/emEvents" and q.get("updatedAfter"):
            body["emEvents"] = [e for e in body.get("emEvents",[]) if e.get("updated","") >= q["updatedAfter"]]
        collection = next((k for k,v in body.items() if isinstance(v,list) and not k.startswith("_") and k != "requests"), None)
        if collection and not path.startswith("/__") and MODE != "partial":
            rows=body[collection]; limit=int(q.get("limit",100)); offset=int(q.get("next") or q.get("offset",0))
            body[collection]=rows[offset:offset+limit]
            body["_metadata"]={"total":len(rows),"limit":limit,"offset":offset,"next":str(offset+limit) if offset+limit<len(rows) else None}
        body.setdefault("_metadata", meta)
        raw = json.dumps(body).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4399
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
