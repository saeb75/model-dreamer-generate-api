# Direct Image Editing with OpenAI Endpoint

## Endpoint: `/edit-images-with-openai`

This endpoint allows you to edit multiple images directly with OpenAI without composition. It converts all non-URL images to URLs and processes each image individually with OpenAI.

### Features:

- Accepts both image URLs and uploaded files
- Converts uploaded files to Cloudinary URLs automatically
- Processes each image individually with OpenAI
- No image composition (unlike the original editImageWithOpenAI)
- Supports face swap when multiple images are provided
- Real-time status updates via WebSocket

### Request Method: POST

### Authentication: Required (Bearer Token)

### Request Body:

```json
{
  "imageUrls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "prompt": "Your editing prompt here",
  "quality": "auto",
  "background": "auto",
  "aspect_ratio": "1:1"
}
```

### Form Data:

- `images`: Array of image files (up to 5 files)

### Response:

```json
{
  "success": true,
  "generationId": "edit_direct_1234567890_abc123",
  "openaiEditing": {
    "success": true,
    "editedImages": [
      {
        "originalUrl": "https://example.com/image1.jpg",
        "editedImageUrl": "https://res.cloudinary.com/...",
        "localFilePath": "/path/to/local/file.png"
      }
    ],
    "totalImages": 2,
    "faceSwapUrl": "https://res.cloudinary.com/..." // if applicable
  },
  "summary": {
    "totalInputImages": 2,
    "urlCount": 1,
    "uploadedCount": 1,
    "hasPrompt": true,
    "allImageUrls": [
      "https://example.com/image1.jpg",
      "https://res.cloudinary.com/..."
    ],
    "hasFaceSwap": true
  }
}
```

### WebSocket Events:

- `generation_started`: When processing begins
- `continue`: Periodic updates during processing
- `generation_completed`: When processing is successful
- `generation_failed`: When processing fails

### Differences from `/edit-with-openai`:

1. **No Composition**: Images are not composed together
2. **Individual Processing**: Each image is processed separately with OpenAI
3. **More Flexible**: Accepts up to 5 images instead of 2-3
4. **Direct Processing**: All images are sent directly to OpenAI without intermediate composition step

### Usage Example:

```javascript
const formData = new FormData();
formData.append("images", file1);
formData.append("images", file2);
formData.append(
  "imageUrls",
  JSON.stringify(["https://example.com/image3.jpg"])
);
formData.append("prompt", "Dress the girl with the clothing shown");

fetch("/edit-images-with-openai", {
  method: "POST",
  headers: {
    Authorization: "Bearer your-token",
  },
  body: formData,
});
```

### cURL Examples:

#### 1. With Uploaded Files Only:

```bash
curl -X POST "http://localhost:3000/edit-images-with-openai" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg" \
  -F "prompt=Dress the girl with the clothing shown" \
  -F "quality=auto" \
  -F "background=auto" \
  -F "aspect_ratio=1:1"
```

#### 2. With Image URLs Only:

```bash
curl -X POST "http://localhost:3000/edit-images-with-openai" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrls": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ],
    "prompt": "Dress the girl with the clothing shown",
    "quality": "auto",
    "background": "auto",
    "aspect_ratio": "1:1"
  }'
```

#### 3. Mixed (URLs + Uploaded Files):

```bash
curl -X POST "http://localhost:3000/edit-images-with-openai" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "images=@/path/to/uploaded_image.jpg" \
  -F "imageUrls=[\"https://example.com/image1.jpg\",\"https://example.com/image2.jpg\"]" \
  -F "prompt=Dress the girl with the clothing shown" \
  -F "quality=auto" \
  -F "background=auto" \
  -F "aspect_ratio=1:1"
```

#### 4. With Multiple Uploaded Files:

```bash
curl -X POST "http://localhost:3000/edit-images-with-openai" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg" \
  -F "images=@/path/to/image3.jpg" \
  -F "images=@/path/to/image4.jpg" \
  -F "images=@/path/to/image5.jpg" \
  -F "prompt=Dress the girl with the clothing shown"
```

### Notes:

- Replace `YOUR_JWT_TOKEN` with your actual JWT token
- Replace `/path/to/image.jpg` with actual file paths
- Replace `https://example.com/image1.jpg` with actual image URLs
- The endpoint accepts up to 5 images total (URLs + uploaded files combined)
- All uploaded files are automatically converted to Cloudinary URLs
