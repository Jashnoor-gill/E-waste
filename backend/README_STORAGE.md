# Storage modes for frames

This backend supports multiple storage modes for device frames. Configure the storage mode via environment variables.

## FRAME_STORAGE
Possible values:
- `gridfs` (default in `.env.sample`) — store images in MongoDB using GridFS. Requires `MONGODB_URI`.
- `s3` — upload images to an S3-compatible bucket using `S3_BUCKET` and credentials.
- (empty) or `memory` — keep the latest frame in memory; non-durable.
- `local` — store frames on local filesystem (not implemented by default; can be added).

## Important environment variables
- `MONGODB_URI` — MongoDB connection string. Required for `gridfs`.
- `GRIDFS_BUCKET` — optional GridFS bucket name (default: `frames`).
- `FRAME_STORAGE` — which storage backend to use (`gridfs|s3|memory`).

S3 variables (if using `s3`):
- `S3_BUCKET`
- `S3_REGION`
- `S3_KEY`
- `S3_SECRET`
- `S3_PRESIGNED_EXPIRES`

Other variables:
- `KEEP_FRAMES_IN_MEMORY` — when `false`, raw base64 frames are cleared from memory after being stored externally (GridFS/S3).

## How it works
- `POST /api/frame/upload_frame` accepts `{ device_id, frame }` where `frame` is base64 image data.
- If `FRAME_STORAGE=gridfs`, the backend stores the binary in GridFS and sets a `gridfsId` entry for the device.
- `GET /api/frame/latest_frame?device_id=...` returns the latest entry for the device. When GridFS is used it returns `{ gridfsId, url }` where `url` is a backend streaming route `/api/frame/get/:id`.
- `GET /api/frame/get/:id` streams the stored image bytes from GridFS with `Content-Type: image/jpeg`.

## Notes and tradeoffs
- GridFS stores files inside your MongoDB instance. It's the easiest option if you already have MongoDB and no additional cloud provider is desired. Expect larger DB size and plan backups accordingly.
- Serving images through the backend is simple but not a CDN. Consider adding a CDN or switching to a dedicated object store if you need high traffic or low-latency global delivery.

## Local testing
1. Copy `.env.sample` to `.env` and set `MONGODB_URI` and `FRAME_STORAGE=gridfs`.
2. Place a small `test.jpg` at the repository root and run:

```powershell
# set env if needed, then
npm install
node backend/scripts/integration-test-frame.js
```

This script uploads `test.jpg`, then downloads the stored image as `downloaded-integration.jpg`.
