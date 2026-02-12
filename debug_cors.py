
import urllib.request

req = urllib.request.Request(
    "https://ttss.zeabur.app/api/check_balance", 
    headers={
        "Origin": "https://mini.xiuzai.space",
        "User-Agent": "Mozilla/5.0"
    }
)

try:
    with urllib.request.urlopen(req) as response:
        headers = response.info()
        print("Status:", response.status)
        print("Headers:", headers)
        with open("headers_origin.txt", "w", encoding="utf-8") as f:
            f.write(str(headers))
except Exception as e:
    print("Error:", e)
    with open("headers_origin.txt", "w", encoding="utf-8") as f:
        f.write(str(e))
