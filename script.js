import {
    FaceDetector,
    FilesetResolver,
    Detection
  } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";
  
  const demosSection = document.getElementById("demos");
  
  let faceDetector; // type: FaceDetector
  let runningMode = "VIDEO";
  
  // Initialize the object detector
  const initializefaceDetector = async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    faceDetector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`, // ML model that detects faces at close range
        delegate: "GPU"
      },
      runningMode: runningMode
    });
    demosSection.classList.remove("invisible");
  };
  initializefaceDetector();

/*************************************************/
// CONTINUOUS FACE DETECTION
/*************************************************/
let video = document.getElementById("webcam");
const liveView = document.getElementById("liveView");
let enableWebcamButton; // type: HTMLButtonElement

// debugging: is the button registering a click:
enableWebcamButton = document.getElementById("webcamButton");
enableWebcamButton.addEventListener("click", console.log("hello"));


// Check if webcam access is supported.
const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;


// Keep a reference of all the child elements we create
// so we can remove them easily on each render.
var children = [];

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.
async function enableCam(event) {
  if (!faceDetector) {
    alert("Face Detector is still loading. Please try again..");
    return;
  }

  // Hide the button.
  enableWebcamButton.classList.add("removed");

  // getUsermedia parameters
  const constraints = {
    video: true
  };

  // Activate the webcam stream.
  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(function (stream) {
      video.srcObject = stream;
      video.addEventListener("loadeddata", predictWebcam);
    })
    .catch((err) => {
      console.error(err);
    });
}

  // Recursive function to continuously track face
let lastVideoTime = -1; // WHY -1? **
async function predictWebcam() {
  // Detect faces using detectForVideo
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const detections = faceDetector.detectForVideo(video, startTimeMs)
      .detections;
    displayVideoDetections(detections);
  }

  // Call this function again to keep predicting when the browser is ready
  window.requestAnimationFrame(predictWebcam);
}

  