import {
  FaceDetector,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let faceDetector; // type: FaceDetector
let runningMode = "VIDEO";
3;
// Initialize the object detector
const initializefaceDetector = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    // use await to pause the async func and temporarily return to main thread until promise resolves: force js to finish this statement first before moving onto the second, as the second is dependent on the first. however, browser can still load animations, etc during this time
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );
  faceDetector = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`, // ML model that detects faces at close range (path to the specific model)
      delegate: "GPU",
    },
    runningMode: runningMode,
    minDetectionConfidence: 0.65,
  });
};
initializefaceDetector(); // returns promises

/*************************************************/
// CONTINUOUS FACE DETECTION
/*************************************************/
let videoFull = document.getElementById("webcamFull"); // html element, empty frame for video
let videoZoom = document.getElementById("webcamMask"); // empty frame for masked video png

// video
const liveFullView = document.getElementById("liveFullView"); // can't change constant vars
const liveMaskView = document.getElementById("liveMaskView"); // div holding the video screen and face detection graphics.
let enableWebcamButton; // type: HTMLButtonElement

// Check if webcam access is supported.
const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia; // !! converts the result to true or false
const hasZoom = () => !!navigator.mediaDevices.getSupportedConstraints().zoom; // true or false, has zoom?
// Keep a reference of all the child elements we create
// so we can remove them easily on each render.
var children = [];

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam); // When someone clicks this button, run the enableCam function
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.
async function enableCam(event) {
  if (!faceDetector) {
    alert("Face Detector is still loading. Please try again..");
    return;
  }

  // Remove the button.
  enableWebcamButton.remove();

  // getUsermedia parameters
  const constraints = {
    video: true,
  };

  // Activate the webcam stream.
  navigator.mediaDevices
    .getUserMedia(constraints) // returns a Promise — meaning it's asynchronous
    .then(function (stream) {
      // stream = a MediaStream object created by getUserMedia()= the actual webcam feed
      // runs when the user accepts cam permissions and the webcam stream is ready.
      // .then(func ()): waits for the Promise by getUserMedia to finish. Once it’s ready, .then() runs the function you write below w the parameter as the thing getUserMedia returns/the thing you're waiting for (ex. When the webcam is ready, run this function and give it the video stream)

      videoFull.srcObject = stream; // link stream to video html element, which until now was just empty frame
      videoZoom.srcObject = stream;

      videoFull.addEventListener("loadeddata", predictWebcam); // When the video finishes loading and is ready to play, run the predictWebcam function.
      videoZoom.addEventListener("loadeddata", predictWebcam);
    })
    .catch((err) => {
      console.error(err);
    });
}
// Zoom setup:
function zoomSetUp() {
  if (hasZoom) {
    console.log("Browser supports zoom");
  } else {
    alert("The browser does not support zoom.");
  }

  // check if the camera has zoom capabilities (same cam for videoZoom and videoFull so just check 1)
  videoZoom.addEventListener("loadedmetadata", () => {
    let capabilities = videoZoom.srcObject
      .getVideoTracks()[0]
      .getCapabilities();
    console.log("capabilities: ", capabilities); // no zoom, but there is resizeMode: A ConstrainDOMString object

    //   if ("zoom" in capabilities) {
    //     let min = capabilities["zoom"]["min"]; // get the min and max zoom values embedded in cam
    //     let max = capabilities["zoom"]["max"];
    //     console.log("min: " + min);
    //     console.log("max: " + max);
    //   } else {
    //     alert("This camera does not support zoom");
    //   }
  });
}
zoomSetUp();

// Recursive function to continuously track face
let lastVideoTime = -1; // to make sure the func can start (-1 will never be equal to the video time)
async function predictWebcam() {
  let startTimeMs = performance.now();
  // Detect faces using detectForVideo
  if (videoFull.currentTime !== lastVideoTime) {
    lastVideoTime = videoFull.currentTime;
    const detections = faceDetector.detectForVideo(
      videoFull,
      startTimeMs
    ).detections;
    // above line returns an object w params: {
    //   detections: [/* array of detected faces */],
    //   timestampMs: 123456789 // processing timestamp
    // } and extracts JUST THE DETECTIONS (1st param), which are objects that contain: {
    //   boundingBox: { /* x,y,width,height */ },
    //   keypoints: [ /* facial landmarks */ ],
    //   confidence: 0.98 // detection certainty
    // }
    displayVideoDetections(detections); // calling func below using the face positions/landmarks in pixel coordinates stored in "detections" => VISUALIZES DETECTIONS
    console.log("got to detections");
  }

  // Call this function again to keep predicting when the browser is ready
  window.requestAnimationFrame(predictWebcam);
}

// VISUALIZES DETECTIONS for each frame
function displayVideoDetections(detections) {
  // detections is an array of Detection[]

  // Remove any highlighting from previous frame (constantly updating each frame).
  for (let child of children) {
    liveFullView.removeChild(child);
  }
  children.splice(0);

  // Iterate through predictions and draw them to the live view
  for (let detection of detections) {
    // create % sign
    const p = document.createElement("p");
    p.innerText =
      "Confidence: " +
      Math.round(parseFloat(detection.categories[0].score) * 100) +
      "%"; // gets score as float, turns into percent, rounds to whole number

    // video.offsetWidth = pixel width of the video element
    // detection.boundingBox.width = width of box
    // detection.boundingBox.originX = start of the horizontal placement of box (upper left corner)
    p.style = // style position of the percent
      "left: " +
      (videoFull.offsetWidth -
        detection.boundingBox.width -
        detection.boundingBox.originX) +
      "px;" +
      "top: " +
      (detection.boundingBox.originY - 30) +
      "px; " +
      "width: " +
      (detection.boundingBox.width - 10) +
      "px;";

    // create box
    const highlighter = document.createElement("div");
    highlighter.setAttribute("class", "highlighter"); // assign css class styling "highlighter"
    highlighter.style =
      "left: " +
      (videoFull.offsetWidth -
        detection.boundingBox.width -
        detection.boundingBox.originX) +
      "px;" +
      "top: " +
      detection.boundingBox.originY +
      "px;" +
      "width: " +
      (detection.boundingBox.width - 10) +
      "px;" +
      "height: " +
      detection.boundingBox.height +
      "px;";

    // add both objects to livestream
    liveFullView.appendChild(highlighter);
    liveFullView.appendChild(p);

    // Store drawn objects in memory so they are queued to delete at next call
    children.push(highlighter);
    children.push(p);

    for (let keypoint of detection.keypoints) {
      const keypointEl = document.createElement("span"); // make an element to represent the keypoint
      keypointEl.className = "key-point"; // assign it a styling class in css
      keypointEl.style.top = `${keypoint.y * videoFull.offsetHeight - 3}px`; // adjust its location to fit the video
      keypointEl.style.left = `${
        videoFull.offsetWidth - keypoint.x * videoFull.offsetWidth - 3
      }px`;
      liveFullView.appendChild(keypointEl); // add to liveFullView
      children.push(keypointEl); // add to children so that it can be deleted on the next frame
    }
  }
}

// Once that works:
// 1. set up zoom
// 2. do some math to link that zoom to the bounding box of the face:
//
// 1. Start webcam stream.
// 2. For each frame:
//    a. Detect subject (face/person) → get bounding box.
//    b. If no subject, gradually reset zoom.
//    c. Else:
//       i. Calculate desired zoom level (e.g., subject width = 50% of frame).
//       ii. Smooth the subject’s position (avoid jumps).
//       iii. Crop the frame around the subject and resize to output dimensions.
// Bonus 1: Add a "padding" parameter to control how much space is around the subject.
//    d. Draw result to <canvas>.
// 3. Repeat.
