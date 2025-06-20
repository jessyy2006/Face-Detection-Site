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

// canvas setup
const canvas = document.getElementById("framedOutput");
const ctx = canvas.getContext("2d");
canvas.width = 640;
canvas.height = 480;

// video
const liveFullView = document.getElementById("liveFullView"); // can't change constant vars
const liveMaskView = document.getElementById("liveMaskView"); // div holding the video screen and face detection graphics.
let enableWebcamButton; // type: HTMLButtonElement

// Check if webcam access is supported.
const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia; // !! converts the result to true or false
const hasZoom = () => !!navigator.mediaDevices.getSupportedConstraints().zoom; // true or false, has zoom? maybe not necessary cuz doing digital zoom
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

      videoFull.addEventListener("loadeddata", () => {
        predictWebcam();
      }); // When the video finishes loading and is ready to play, run the predictWebcam function.
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
}
zoomSetUp();

// check if the camera has zoom capabilities (same cam for videoZoom and videoFull so just check 1)
videoZoom.addEventListener("loadedmetadata", async () => {
  let track = videoZoom.srcObject.getVideoTracks()[0];
  let capabilities = track.getSettings();
  console.log("capabilities: ", capabilities); // no zoom, but there is resizeMode: A ConstrainDOMString object

  // change resizeMode to scale and crop, if necessary (add if else):
  // Try to CHANGE resizeMode (correct way)
  try {
    await track.applyConstraints({
      advanced: [{ resizeMode: "crop-and-scale" }],
    });
    console.log("Successfully requested 'crop-and-scale'!");
  } catch (err) {
    console.error("Failed to set resizeMode:", err);
  }
  console.log("new capabilities: ", capabilities);
  // when I use .getSettings():
  // - aspectRatio = 1.333(4x3)
  // - width = 640
  // - height = 480
  // - resizeMode rn = none, but i wanna change to 'crop-and-scale'?

  //   if ("zoom" in capabilities) {
  //     let min = capabilities["zoom"]["min"]; // get the min and max zoom values embedded in cam
  //     let max = capabilities["zoom"]["max"];
  //     console.log("min: " + min);
  //     console.log("max: " + max);
  //   } else {
  //     alert("This camera does not support zoom");
  //   }
});

// Recursive function to continuously track face
let lastVideoTime = -1; // to make sure the func can start (-1 will never be equal to the video time)
let frameCounter = 0;
let oldFace = null;
let detections = null;
async function predictWebcam() {
  let startTimeMs = performance.now();
  // Detect faces using detectForVideo
  if (videoFull.currentTime !== lastVideoTime) {
    lastVideoTime = videoFull.currentTime;
    detections = faceDetector.detectForVideo(videoFull, startTimeMs).detections;
    // above line returns an object w params: {
    //   detections: [/* array of detected faces */],
    //   timestampMs: 123456789 // processing timestamp
    // } and extracts JUST THE DETECTIONS (1st param), which are objects that contain: {
    //   boundingBox: { /* x,y,width,height */ },
    //   keypoints: [ /* facial landmarks */ ],
    //   confidence: 0.98 // detection certainty
    // }
    displayVideoDetections(detections); // calling func below using the face positions/landmarks in pixel coordinates stored in "detections" => VISUALIZES DETECTIONS. since mediapipe orders the most prominently detected face first, detections[0] is the most obvious face.
    console.log("got to detections");

    const newFace = detections[0].boundingBox;

    if (frameCounter % 20 === 0) {
      if (!oldFace) {
        // checks if it is !null = !false = true
        oldFace = newFace;
      }

      // every 20 frames, including first
      didPositionChange(newFace, oldFace); // => then run processFrame within this func
      oldFace = newFace;
    }
    processFrame(detections);

    frameCounter++;
  }

  // Call this function again to keep predicting when the browser is ready
  window.requestAnimationFrame(predictWebcam);
}

// VISUALIZES DETECTIONS for each frame. this code is still for detecting multiple people.
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

/*************************************************/
// FACE TRACKING + ZOOM
/*************************************************/
// TO-DOs:
// - Add a "padding" parameter to control how much space is around the subject.

// Configuration for face tracking mechanism
const TARGET_FACE_RATIO = 0.3; // Face height = 30% of frame height
const SMOOTHING_FACTOR = 0.2; // For exponential moving average to smooth, aka how much you trust the new value

// smoothing declarations
let smoothedX = 0,
  smoothedY = 0,
  smoothWidth = 0;

function processFrame(detections) {
  console.log("got to processing canvas");
  if (!detections || detections.length === 0) {
    // No face: need to gradually reset zoom instead of making it abrupt
    return;
  }

  // without smooth for now
  const face = detections[0].boundingBox; // most prom face -> get box.

  let xCenter = face.originX + face.width / 2;
  let yCenter = face.originY + face.height / 2; // current raw value

  // 1. Smooth face position (EMA)
  // Initialize on first detection so isn't initialized to 0
  if (smoothWidth === 0) {
    smoothedX = xCenter;
    smoothedY = yCenter;
    smoothWidth = face.width;
  }
  smoothWidth =
    face.width * SMOOTHING_FACTOR + (1 - SMOOTHING_FACTOR) * smoothedWidth;
  smoothedX = xCenter * SMOOTHING_FACTOR + (1 - SMOOTHING_FACTOR) * smoothedX;
  smoothedY = yCenter * SMOOTHING_FACTOR + (1 - SMOOTHING_FACTOR) * smoothedY; // use old smoothed value to get new smoothed value. this gets a "ratio" where new smoothedY is made up w a little bit of the new value and most of the old

  // 2. calc zoom level
  let targetFacePixels = TARGET_FACE_RATIO * canvas.height; // % of the canvas u wanna take up * height of canvas
  let zoomScale = targetFacePixels / smoothed.width; // how much should our face be scaled based on its current bounding box width?

  console.log("got to drawing canvas with face: ", face);
  ctx.drawImage(
    // source video
    videoFull,

    // cropped from source
    canvas.offsetWidth - smoothedX - canvas.width / (2 * zoomScale), // top left corner of crop in og vid
    smoothedY - canvas.height / (2 * zoomScale), // canvas.height / (2 * zoomScale) = half the height of the cropped area
    smoothWidth / zoomScale, // how wide a piece we're cropping from original vid
    canvas.height / zoomScale, // how tall

    // destination
    0, // x coord for where on canvas to start drawing (left->right)
    0,
    canvas.width, // since canvas width/height is hardcoded to my video resolution, this maintains aspect ratio. should change this to update to whatever cam resolution rainbow uses.
    canvas.height
  );
}

// check if face position has changed enough to warrant tracking
function didPositionChange(newFace, oldFace) {
  const thresholdX = canvas.width * 0.05; // 5% of the width
  const thresholdY = canvas.height * 0.05; // 5% of the height

  const zoomRatio = newFace.width / oldFace.width;
  const zoomThreshold = 0.05; // allow 5% zoom change before reacting

  if (
    Math.abs(newFace.originX - oldFace.originX) > thresholdX ||
    Math.abs(newFace.originY - oldFace.originY) > thresholdY
  ) {
    // if position OR distance from cam changed a lot
    processFrame(detections);
  } else if (Math.abs(1 - zoomRatio) > zoomThreshold) {
    processFrame(detections);
  } else {
    return; // exit
  }
}

// issues:
// 1. doesn't stop me from going offscreen
// 2. duplicate pictures when come close to camera (need to add a lower bound on face framing...maybe no zoom at all once face is filling frame to a certain point, just tracking ?)
// 3. if start close to camera, drawImage projects a smaller - than - canvas video that only increases as i move back and fill up the frame...prob has something to do with canvas sizing / drawImage setup
// 4. very choppy animation and very jittery, add smoothing
// 5. if face isn't recognizable, zoom autoresets, which can be jarring. maybe a slow return to 100% canvas fill w video? this can also be changed by changing the confidence bound for face detection, but runs the risk of detecting things that aren't faces at all/poor detection
// 6. when person leaves frame, camera freezes on wherever the face was last seen...like #5, figure out a way to smoothly transition back to just the full video stream w no zoom
// 7. when another person enters frame and both faces are equally visible (one isn't very far in back), because processFrame() only creates face based on the most "prominent face", if both are oscillating between being equally as promiminent with every small movement, the camera zoom jumps around. Solve: could just remove all detections from detections array except for first one every time it detects face (every frame) so it literally can only adapt to the first person it sees...? not sure act.

// mathieu's issues:
// - Managing model errors (when your model is talking nonsense or when it doesn't detect anything at all): when the results returned by your model are too different from one frame to another, keep the current position of your zoom window.

// - Don't move the zoom window with each frame; wait until there is a significant difference in position for a few frames (10/20/30 frames?) before moving it.

// ADDRESSED:
// - Don't move your window “abruptly”; instead, try to do a kind of smooth tracking/zoom (smooth it out over several frames (the number of which is to be determined)
