// Use globals injected via CDN
const tf = (window as any).tf;
const poseDetection = (window as any).poseDetection;

// Smoothing factor for EWMA (Exponential Weighted Moving Average)
const SMOOTHING_FACTOR = 0.5;

let detector: any = null;
let previousKeypoints: { [name: string]: any } = {};

export const initDetector = async () => {
  if (detector) return detector;
  await tf.setBackend('webgl');
  await tf.ready();
  const model = poseDetection.SupportedModels.MoveNet;
  const detectorConfig = {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    enableSmoothing: true,
  };
  detector = await poseDetection.createDetector(model, detectorConfig);
  return detector;
};

export const getPose = async (video: HTMLVideoElement) => {
  if (!detector) return null;
  try {
    const poses = await detector.estimatePoses(video, {
      flipHorizontal: false // We handle flipping in canvas
    });
    if (poses.length > 0) {
      return applySmoothing(poses[0]);
    }
  } catch (e) {
    console.error("Pose estimation error", e);
  }
  return null;
};

const applySmoothing = (pose: any) => {
  if (!pose.keypoints) return pose;
  
  // Use any since we removed the npm types
  const smoothedKeypoints = (pose.keypoints as any[]).map(kp => {
    if (!kp.name) return kp;
    
    const prev = previousKeypoints[kp.name];
    if (prev && kp.score && kp.score >= 0.35) {
      kp.x = prev.x * (1 - SMOOTHING_FACTOR) + kp.x * SMOOTHING_FACTOR;
      kp.y = prev.y * (1 - SMOOTHING_FACTOR) + kp.y * SMOOTHING_FACTOR;
    }
    
    if (kp.score && kp.score >= 0.35) {
      previousKeypoints[kp.name] = { ...kp };
    } else {
      // If the point is low confidence, clear its history so we don't interpolate from a stale position later
      delete previousKeypoints[kp.name];
    }
    
    return kp;
  });

  return { ...pose, keypoints: smoothedKeypoints };
};

export const clearSmoothing = () => {
  previousKeypoints = {};
};
