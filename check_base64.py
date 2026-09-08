import urllib.request
import json
import base64

BASE = "https://wishtree.up.railway.app"

req = urllib.request.Request(BASE + "/charity/project/CH3")
resp = urllib.request.urlopen(req, timeout=15)
p = json.loads(resp.read())

# Check photo
photo = p.get('photo', '')
if photo.startswith('data:image/jpeg;base64,'):
    b64data = photo[len('data:image/jpeg;base64,'):]
    print(f"Photo base64 length: {len(b64data)}")
    print(f"Photo length mod 4: {len(b64data) % 4}")
    try:
        img_data = base64.b64decode(b64data)
        print(f"Photo decoded size: {len(img_data)} bytes")
        print(f"Photo JPEG header valid: {img_data[:2] == b'\\xff\\xd8'}")
    except Exception as e:
        print(f"Photo decode failed: {e}")

# Check proof
proof = p.get('proof', '')
if proof.startswith('data:image/jpeg;base64,'):
    b64data = proof[len('data:image/jpeg;base64,'):]
    print(f"\nProof base64 length: {len(b64data)}")
    print(f"Proof length mod 4: {len(b64data) % 4}")
    # Try to fix by adding padding
    padded = b64data + '=' * (4 - len(b64data) % 4) if len(b64data) % 4 != 0 else b64data
    try:
        img_data = base64.b64decode(padded)
        print(f"Proof decoded size (with padding fix): {len(img_data)} bytes")
        print(f"Proof JPEG header valid: {img_data[:2] == b'\\xff\\xd8'}")
    except Exception as e:
        print(f"Proof decode failed even with padding: {e}")
