import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { initDetector, getPose, clearSmoothing } from './utils/poseDetection';
import { api } from '../../api/axios';

interface ProductDetail {
  id: number;
  name: string;
  price: number;
  imageUrl?: string;
  arImageUrl: string | null;
  arTorsoUrl?: string | null;
  arLeftSleeveUrl?: string | null;
  arRightSleeveUrl?: string | null;
  arType: 'TOP' | 'BOTTOM' | 'DRESS';
}

export const TryOnPage = () => {
  const { variantId } = useParams();
  const navigate = useNavigate();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [noBodyDetected, setNoBodyDetected] = useState(false);
  
  const garmentImage = useRef<HTMLImageElement | null>(null);
  const garmentTorsoImage = useRef<HTMLImageElement | null>(null);
  const garmentLeftSleeveImage = useRef<HTMLImageElement | null>(null);
  const garmentRightSleeveImage = useRef<HTMLImageElement | null>(null);

  // Load product data
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const { data } = await api.get(`/store/try-on/${variantId}`);
        const productData = data.product;
        
        const effectiveImageUrl = productData.arImageUrl || productData.imageUrl;
        if (!productData.arEnabled || !productData.arType || !effectiveImageUrl) {
          setError('Este producto no soporta prueba virtual o carece de información requerida.');
          return;
        }

        const img = new Image();
        img.src = effectiveImageUrl;
        img.crossOrigin = "anonymous";
        img.onload = () => {
          garmentImage.current = img;
        };

        if (productData.arTorsoUrl && productData.arLeftSleeveUrl && productData.arRightSleeveUrl) {
          const tImg = new Image(); tImg.src = productData.arTorsoUrl; tImg.crossOrigin = "anonymous";
          tImg.onload = () => { garmentTorsoImage.current = tImg; };
          const lImg = new Image(); lImg.src = productData.arLeftSleeveUrl; lImg.crossOrigin = "anonymous";
          lImg.onload = () => { garmentLeftSleeveImage.current = lImg; };
          const rImg = new Image(); rImg.src = productData.arRightSleeveUrl; rImg.crossOrigin = "anonymous";
          rImg.onload = () => { garmentRightSleeveImage.current = rImg; };
        }

        setProduct(productData);
      } catch (err) {
        setError('Error al cargar la información del producto.');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [variantId]);

  // Start Camera
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: 640, height: 480 } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setTracking(true);
            initDetector().then(() => {
              renderLoop();
            });
          };
        }
      } catch (err) {
        console.error('Error de cámara:', err);
        setCameraError('Permiso de cámara denegado o no disponible.');
      }
    };

    if (!loading && !error) {
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      clearSmoothing();
    };
  }, [loading, error]);

  const renderLoop = async () => {
    if (!videoRef.current || !canvasRef.current || !product || !garmentImage.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (video.readyState < 2) {
      requestRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    // Match canvas size to video size
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pose = await getPose(video);

    if (pose && pose.keypoints) {
      const kps = pose.keypoints;
      
      const getPt = (idx: number) => {
        const kp = kps[idx];
        return (kp && kp.score && kp.score > 0.35) ? kp : null;
      };

      const ls = getPt(5); // left_shoulder
      const rs = getPt(6); // right_shoulder
      const le = getPt(7); // left_elbow
      const re = getPt(8); // right_elbow
      const lh = getPt(11); // left_hip
      const rh = getPt(12); // right_hip
      const lk = getPt(13); // left_knee
      const rk = getPt(14); // right_knee

      let detected = false;

      ctx.save();
      // We flip the canvas because the video is mirrored via CSS scaleX(-1)
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);

      if (product.arType === 'TOP' && ls && rs && lh && rh) {
        detected = true;
        
        const midShoulder = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
        const midHip = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
        
        const shoulderDist = Math.hypot(rs.x - ls.x, rs.y - ls.y);
        const torsoHeight = Math.hypot(midHip.x - midShoulder.x, midHip.y - midShoulder.y);
        
        const width = shoulderDist * 2.1;
        const height = torsoHeight * 1.6;

        const isArticulated = garmentTorsoImage.current && garmentLeftSleeveImage.current && garmentRightSleeveImage.current;

        if (isArticulated) {
          // Draw torso
          ctx.save();
          const angle = Math.atan2(rs.y - ls.y, ls.x - rs.x);
          ctx.translate(midShoulder.x, midShoulder.y);
          ctx.rotate(angle);
          ctx.drawImage(garmentTorsoImage.current!, -width / 2, -height * 0.1, width, height);
          ctx.restore();

          // Draw sleeves
          const drawSleeve = (shoulder: any, elbow: any, hip: any, img: HTMLImageElement, isLeft: boolean) => {
            let ex, ey;
            if (elbow) {
              ex = elbow.x;
              ey = elbow.y;
            } else {
              const hx = hip.x - shoulder.x;
              const hy = hip.y - shoulder.y;
              const hlen = Math.hypot(hx, hy) || 1;
              const sLen = hlen * 0.4;
              ex = shoulder.x + (hx / hlen) * sLen;
              ey = shoulder.y + (hy / hlen) * sLen;
            }

            const sx = shoulder.x;
            const sy = shoulder.y;
            const dx = ex - sx;
            const dy = ey - sy;
            let sAngle = Math.atan2(dy, dx);
            const sLength = Math.hypot(dx, dy);

            const sWidth = sLength * 1.3;
            const sHeight = sWidth * 0.4;
            const overlap = sWidth * 0.15; // 15% overlap on the shoulder

            ctx.save();
            ctx.translate(sx, sy);
            
            if (isLeft) {
              ctx.rotate(sAngle);
              ctx.drawImage(img, -overlap, -sHeight / 2, sWidth, sHeight);
            } else {
              sAngle = sAngle - Math.PI;
              ctx.rotate(sAngle);
              ctx.drawImage(img, -sWidth + overlap, -sHeight / 2, sWidth, sHeight);
            }
            
            ctx.restore();
          };

          drawSleeve(ls, le, lh, garmentLeftSleeveImage.current!, true);
          drawSleeve(rs, re, rh, garmentRightSleeveImage.current!, false);

        } else {
          // Fallback to rigid
          const angle = Math.atan2(rs.y - ls.y, ls.x - rs.x);
          ctx.save();
          ctx.translate(midShoulder.x, midShoulder.y);
          ctx.rotate(angle);
          ctx.drawImage(garmentImage.current!, -width / 2, -height * 0.1, width, height);
          ctx.restore();
        }

      } else if (product.arType === 'BOTTOM' && lh && rh) {
        detected = true;
        
        const midHip = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
        const hipDist = Math.hypot(rh.x - lh.x, rh.y - lh.y);
        const angle = Math.atan2(rh.y - lh.y, lh.x - rh.x);
        
        const width = hipDist * 2.3;
        let height = width * 1.8; // default fallback height
        
        if (lk && rk) {
           const midKnee = { x: (lk.x + rk.x) / 2, y: (lk.y + rk.y) / 2 };
           height = Math.hypot(midKnee.x - midHip.x, midKnee.y - midHip.y) * 1.4;
        }

        ctx.translate(midHip.x, midHip.y);
        ctx.rotate(angle);
        
        ctx.drawImage(garmentImage.current, -width / 2, 0, width, height);
        
      } else if (product.arType === 'DRESS' && ls && rs && lh && rh) {
        detected = true;
        
        const midShoulder = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
        const midHip = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
        const shoulderDist = Math.hypot(rs.x - ls.x, rs.y - ls.y);
        const angle = Math.atan2(rs.y - ls.y, ls.x - rs.x);
        
        const width = shoulderDist * 2.1;
        let height = 0;

        if (lk && rk) {
          const midKnee = { x: (lk.x + rk.x) / 2, y: (lk.y + rk.y) / 2 };
          height = Math.hypot(midKnee.x - midShoulder.x, midKnee.y - midShoulder.y) * 1.2;
        } else {
          // Estimate length if knees not confident enough
          const torsoHeight = Math.hypot(midHip.x - midShoulder.x, midHip.y - midShoulder.y);
          height = torsoHeight * 2.5; 
        }

        ctx.translate(midShoulder.x, midShoulder.y);
        ctx.rotate(angle);
        
        ctx.drawImage(garmentImage.current, -width / 2, -height * 0.1, width, height);
      }

      ctx.restore();
      
      // Fix React stale closure: use callback form to compare with latest state
      setNoBodyDetected(prev => {
        if (prev === detected) return !detected;
        return prev;
      });
      
      if (!detected) {
         clearSmoothing();
      }

      // ----------------------------------------------------
      // DEBUG VISUALIZATION
      // ----------------------------------------------------
      ctx.save();
      const drawDebugKp = (label: string, kp: any) => {
        if (!kp) return;
        
        // El canvas principal está sin voltear al momento de este ctx.save(),
        // pero la vista de video está volteada con CSS scaleX(-1).
        // Si no volteamos el ctx, dibujaremos en coordenadas físicas.
        // Pero los puntos kps ya vienen orientados según el frame de video.
        // Como disableFlipHorizontal es true (flipHorizontal: false), MoveNet
        // asume la imagen tal cual. El video visualmente está volteado.
        // Para alinear el debug con el canvas sin rotar (pero que coincida visualmente):
        const x = canvas.width - kp.x;
        const y = kp.y;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = kp.score > 0.35 ? '#00FF00' : '#FF0000';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#000';
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillText(`${label} ${(kp.score || 0).toFixed(2)}`, x + 8, y + 4);
        ctx.shadowColor = 'transparent';
      };

      drawDebugKp('LS', kps[5]);
      drawDebugKp('RS', kps[6]);
      drawDebugKp('LH', kps[11]);
      drawDebugKp('RH', kps[12]);
      drawDebugKp('LK', kps[13]);
      drawDebugKp('RK', kps[14]);
      ctx.restore();
      // ----------------------------------------------------
    } else {
      setNoBodyDetected(prev => {
        if (prev === false) return true;
        return prev;
      });
      clearSmoothing();
    }

    requestRef.current = requestAnimationFrame(renderLoop);
  };

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Cargando vestidor virtual...</div>;
  if (error) return <div style={{ padding: '50px', textAlign: 'center', color: 'red' }}>{error}</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button 
          onClick={() => navigate(-1)} 
          style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#f0f0f0', border: 'none', borderRadius: '4px' }}
        >
          &larr; Volver
        </button>
        <h2 style={{ margin: 0 }}>{product?.name}</h2>
      </div>

      {cameraError ? (
        <div style={{ padding: '20px', backgroundColor: '#fee', color: 'red', borderRadius: '8px' }}>
          {cameraError}
        </div>
      ) : (
        <div 
          ref={containerRef}
          style={{ 
            position: 'relative', 
            width: '100%', 
            maxWidth: '640px', 
            aspectRatio: '4/3',
            backgroundColor: '#000',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}
        >
          {tracking && noBodyDetected && (
            <div style={{
              position: 'absolute',
              top: '20px', left: '50%', transform: 'translateX(-50%)',
              backgroundColor: 'rgba(255,0,0,0.7)', color: '#fff', padding: '10px 20px', borderRadius: '20px', zIndex: 10
            }}>
              Cuerpo no detectado. Site a una distancia adecuada.
            </div>
          )}
          
          <video 
            ref={videoRef}
            playsInline
            muted
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)' // Espejado
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              pointerEvents: 'none'
            }}
          />
        </div>
      )}

      <div style={{ marginTop: '20px', color: '#666', textAlign: 'center' }}>
        <p>Prenda: {product?.arType}</p>
        <p style={{ fontSize: '0.9rem' }}>El procesamiento de AR se realiza localmente en tu dispositivo.</p>
      </div>

    </div>
  );
};
