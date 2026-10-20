"""Register the Service Ceo App ID with Apple using existing GitHub Actions secrets.
Never prints the API token or P8 key. Safe to re-run when IDs already exist.
"""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import jwt

ISSUER = os.environ["APP_STORE_CONNECT_ISSUER_ID"]
KEY_ID = os.environ["APP_STORE_CONNECT_KEY_ID"]
PRIVATE_KEY = os.environ["APP_STORE_CONNECT_KEY"]
now = int(time.time())
token = jwt.encode(
    {"iss": ISSUER, "iat": now, "exp": now + 600, "aud": "appstoreconnect-v1"},
    PRIVATE_KEY,
    algorithm="ES256",
    headers={"kid": KEY_ID, "typ": "JWT"},
)
BASE = "https://api.appstoreconnect.apple.com/v1/bundleIds"

def request(url, payload=None):
    headers = {"Authorization": "Bearer " + token, "Accept": "application/json"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if payload else "GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.load(res)
    except urllib.error.HTTPError as error:
        message = error.read().decode("utf-8", "replace")
        try:
            data = json.loads(message)
            details = "; ".join(
                (e.get("code", "") + ": " + e.get("detail", ""))[:320]
                for e in data.get("errors", [])[:3]
            )
        except Exception:
            details = "Apple API rejected request"
        raise RuntimeError("Apple returned HTTP " + str(error.code) + ": " + details) from None

for identifier, name in (("com.aarsvold.serviceceo", "Service Ceo"), ("com.aarsvold.serviceceo.widget", "Service Ceo Widget")):
    query = urllib.parse.urlencode({"filter[identifier]": identifier})
    response = request(BASE + "?" + query)
    if response.get("data"):
        print(identifier + ": already registered")
        continue
    data = {
        "data": {
            "type": "bundleIds",
            "attributes": {"name": name, "platform": "IOS", "identifier": identifier},
        }
    }
    request(BASE, data)
    print(identifier + ": registered successfully")
