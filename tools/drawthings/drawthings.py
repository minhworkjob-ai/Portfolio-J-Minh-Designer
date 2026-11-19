#!/usr/bin/env python3
"""Draw Things API client (CLI) — chỉ dùng thư viện chuẩn Python.

Bật trong Draw Things: Settings → Advanced → API Server (HTTP, port 7860).
API tương thích kiểu AUTOMATIC1111: /sdapi/v1/txt2img, /sdapi/v1/img2img.

Ví dụ:
  python3 drawthings.py txt2img -p "poster tối giản, màu cam" -W 768 -H 1024 -o out/
  python3 drawthings.py img2img -i sketch.png -p "banner hoàn thiện" --strength 0.6
  python3 drawthings.py batch prompts.json -o out/
  python3 drawthings.py ping

Máy khác trong LAN:  --url http://192.168.1.20:7860  (hoặc env DRAWTHINGS_URL)
"""
import argparse, base64, json, os, sys, time, urllib.error, urllib.request

DEFAULT_URL = os.environ.get("DRAWTHINGS_URL", "http://127.0.0.1:7860")


def post(url, path, payload, timeout):
    req = urllib.request.Request(
        url.rstrip("/") + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except urllib.error.URLError as e:
        sys.exit(f"Không kết nối được {url} ({e.reason}). Đã bật API Server trong Draw Things chưa?")


def build_payload(a, init_image=None):
    p = {
        "prompt": a.prompt,
        "negative_prompt": a.negative or "",
        "width": a.width, "height": a.height,
        "steps": a.steps, "guidance_scale": a.cfg,
        "seed": a.seed, "batch_size": a.count,
    }
    if a.sampler: p["sampler"] = a.sampler
    if a.model: p["model"] = a.model
    if init_image:
        p["init_images"] = [init_image]
        p["strength"] = a.strength
    # --extra '{"loras":[...]}' để truyền thêm tham số riêng của Draw Things
    if a.extra: p.update(json.loads(a.extra))
    return p


def save(images, outdir, tag):
    os.makedirs(outdir, exist_ok=True)
    paths = []
    for i, b64 in enumerate(images):
        path = os.path.join(outdir, f"{tag}_{time.time_ns()}_{i}.png")
        with open(path, "wb") as f:
            f.write(base64.b64decode(b64.split(",", 1)[-1]))
        paths.append(path)
        print(path)
    return paths


def read_b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def run(a, kind, init=None):
    data = post(a.url, f"/sdapi/v1/{kind}", build_payload(a, init), a.timeout)
    imgs = data.get("images") or sys.exit(f"Server không trả ảnh: {str(data)[:200]}")
    return save(imgs, a.out, kind)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--timeout", type=int, default=600)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def common(s, prompt_required=True):
        s.add_argument("-p", "--prompt", required=prompt_required, default="")
        s.add_argument("-n", "--negative")
        s.add_argument("-W", "--width", type=int, default=512)
        s.add_argument("-H", "--height", type=int, default=512)
        s.add_argument("--steps", type=int, default=20)
        s.add_argument("--cfg", type=float, default=7.0)
        s.add_argument("--seed", type=int, default=-1)
        s.add_argument("--sampler"); s.add_argument("--model")
        s.add_argument("--count", type=int, default=1)
        s.add_argument("--extra", help="JSON tham số bổ sung")
        s.add_argument("-o", "--out", default="out")

    t = sub.add_parser("txt2img"); common(t)
    i = sub.add_parser("img2img"); common(i)
    i.add_argument("-i", "--image", required=True)
    i.add_argument("--strength", type=float, default=0.7)
    b = sub.add_parser("batch", help="JSON: list các job, mỗi job có prompt + tham số tuỳ chọn")
    common(b, prompt_required=False); b.add_argument("file")
    b.add_argument("--strength", type=float, default=0.7)
    sub.add_parser("ping")

    a = ap.parse_args(argv)
    if a.cmd == "ping":
        try:
            urllib.request.urlopen(a.url, timeout=5)
        except urllib.error.HTTPError:
            pass  # có phản hồi HTTP = server đang chạy
        except Exception as e:
            sys.exit(f"Không kết nối được: {e}")
        print("OK:", a.url); return
    if a.cmd == "txt2img": run(a, "txt2img")
    elif a.cmd == "img2img": run(a, "img2img", read_b64(a.image))
    else:
        jobs = json.load(open(a.file))
        for n, job in enumerate(jobs, 1):
            j = argparse.Namespace(**{**vars(a), **{k.replace("-", "_"): v for k, v in job.items()}})
            img = j.__dict__.pop("image", None)
            print(f"[{n}/{len(jobs)}] {j.prompt[:60]}")
            run(j, "img2img" if img else "txt2img", read_b64(img) if img else None)


if __name__ == "__main__":
    main()
