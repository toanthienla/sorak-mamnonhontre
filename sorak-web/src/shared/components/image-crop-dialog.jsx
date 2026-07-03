import { useState, useRef, useCallback } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  // Returns pixel crop
  const pct = centerCrop(
    makeAspectCrop({ unit: '%', width: 80 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
  // Convert % to px
  return {
    unit: 'px',
    x: (pct.x / 100) * mediaWidth,
    y: (pct.y / 100) * mediaHeight,
    width: (pct.width / 100) * mediaWidth,
    height: (pct.height / 100) * mediaHeight,
  };
}

async function getCroppedBlob(image, crop, fileName) {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const pixelRatio = window.devicePixelRatio || 1;
  const cropW = crop.width * scaleX;
  const cropH = crop.height * scaleY;

  canvas.width = Math.floor(cropW * pixelRatio);
  canvas.height = Math.floor(cropH * pixelRatio);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    cropW,
    cropH,
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        resolve({ file, url: URL.createObjectURL(blob) });
      },
      'image/jpeg',
      0.9,
    );
  });
}

export function ImageCropDialog({ open, imageSrc, fileName, onConfirm, onCancel, aspect = 1 }) {
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const imgRef = useRef(null);

  const onImageLoad = useCallback(
    (e) => {
      const { width, height } = e.currentTarget;
      setCrop(centerAspectCrop(width, height, aspect));
    },
    [aspect],
  );

  const handleConfirm = async () => {
    if (!imgRef.current || !completedCrop) return;
    const result = await getCroppedBlob(imgRef.current, completedCrop, fileName ?? 'photo.jpg');
    onConfirm(result.file, result.url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cắt ảnh</DialogTitle>
        </DialogHeader>

        <div className="flex justify-center max-h-[60vh] overflow-auto">
          {imageSrc && (
            <ReactCrop
              crop={crop}
              onChange={(px) => setCrop(px)}
              onComplete={(px) => setCompletedCrop(px)}
              aspect={aspect}
              circularCrop={false}
              keepSelection
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="crop"
                onLoad={onImageLoad}
                style={{ maxHeight: '55vh', maxWidth: '100%', objectFit: 'contain' }}
              />
            </ReactCrop>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Kéo để chọn vùng ảnh. Tỷ lệ 1:1.
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Hủy
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
