import urllib.request
import json
import base64

BASE = "https://wishtree.up.railway.app"

# Check build version
req = urllib.request.Request(BASE + "/api/state")
try:
    resp = urllib.request.urlopen(req, timeout=15)
    data = json.loads(resp.read())
    print(f"Server BUILD: {data.get('build', 'unknown')}")
except Exception as e:
    print(f"State check failed: {e}")

# Check CH3 proof - decode and see if it's a valid image
req2 = urllib.request.Request(BASE + "/charity/project/CH3")
resp2 = urllib.request.urlopen(req2, timeout=15)
p = json.loads(resp2.read())
proof = p.get('proof', '')

if proof.startswith('data:image/jpeg;base64,'):
    b64data = proof[len('data:image/jpeg;base64,'):]
    try:
        img_data = base64.b64decode(b64data)
        print(f"\nProof image decoded size: {len(img_data)} bytes")
        print(f"First 4 bytes (hex): {img_data[:4].hex()}")
        # JPEG starts with FFD8FF
        if img_data[:2] == b'\xff\xd8':
            print("Valid JPEG header")
        else:
            print("NOT a valid JPEG header")
        # Save to file for inspection
        with open('ch3_proof_check.jpg', 'wb') as f:
            f.write(img_data)
        print("Saved to ch3_proof_check.jpg")
    except Exception as e:
        print(f"Decode failed: {e}")
else:
    print(f"\nProof doesn't start with data URI: {proof[:50]}")
