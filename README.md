# Drishti - AI Audio Guide for the Visually Impaired

**Live demo:** https://drishti-hazel-tau.vercel.app

Drishti (Hindi for "vision") is a browser-based assistive tool. Point your camera ahead and it tells you, out loud and in large captions, **what is around you, which direction it is in, roughly how far it is, and how to move**. It can also **read Indian currency notes** using a custom machine learning model trained with Teachable Machine.

Built for **BUILD WITH ML**, the individual innovation challenge by Coding Connoisseurs, Faculty of Engineering and Technology, University of Lucknow (11-12 October 2026).

---

## The problem

Moving through unfamiliar places is hard without sight. A white cane detects what it touches, but not what is a few steps ahead or what an object is. Telling one currency note from another is also difficult.

## Existing solutions

Apps such as Be My Eyes, Microsoft Seeing AI and Google Lookout help blind users. Many need an app install, several rely on an internet connection or a volunteer, and Hindi support is often limited.

## What Drishti adds

- Opens in any modern browser, with no install.
- Object detection runs **on the device**, so the camera feed is never uploaded.
- Says the object, its direction (left, ahead, right) and an approximate distance.
- Gives simple movement guidance, for example "Move slightly right", and warns when something is very close ahead.
- Reads Indian currency notes with a **custom-trained model**.
- Speech and captions in **English and Hindi**, with large high-contrast text.
- Tap the camera view (or press the Describe button, or the `D` key) to hear a full description of the surroundings.

---

## How it works

1. **See:** Camera frames are sent to **COCO-SSD** (TensorFlow.js), a pre-trained model that detects about 80 everyday objects, running in the browser.
2. **Understand:**
   - The horizontal position of each bounding box gives the direction (left, ahead, right).
   - The height of the box, together with a typical real-world height for that object, gives an approximate distance.
   - Simple rules turn this into guidance: if something is close and straight ahead, suggest the clearer side, or stop if both sides are blocked.
3. **Recognise notes:** Every few frames the camera image is also passed to a **custom image classification model** trained on Teachable Machine with currency note images.
4. **Speak:** The browser's built-in Web Speech API reads short sentences aloud. Messages are throttled so the same thing is not repeated constantly, and objects must appear in consecutive frames before they are announced, which reduces false alarms.

## Tech stack

| Part | Technology |
|------|------------|
| Interface | HTML, CSS, JavaScript (no framework) |
| Object detection | TensorFlow.js + COCO-SSD (lite MobileNet v2) |
| Custom model | Teachable Machine image model, exported to TensorFlow.js |
| Voice | Web Speech API (speech synthesis) |
| Hosting | GitHub + Vercel |

---

## Files in this repository

```
index.html      Page structure
style.css       Styling
script.js       All the logic (detection, guidance, speech, custom model)
model.json      Custom model architecture (from Teachable Machine)
metadata.json   Custom model class names (from Teachable Machine)
weights.bin     Custom model weights (from Teachable Machine)
README.md       This file
```

## Run it locally

Camera access needs a secure context, so open the site through a local server rather than double-clicking `index.html`.

```bash
# from inside the project folder
python3 -m http.server 8000
```

Then open http://localhost:8000 in Chrome or Edge, press **Start**, and allow the camera.

## Deploy

1. Push these files to a GitHub repository.
2. Import the repository in Vercel. Use the **Other** framework preset and leave the build command and output directory empty.
3. Vercel serves the site over HTTPS, which the camera requires.

---

## Training the currency model

1. Go to [Teachable Machine](https://teachablemachine.withgoogle.com/) and create a **Standard image model**.
2. Make one class for each note (for example "10 Rupee Note", "20 Rupee Note", "500 Rupee Note") and one `Background` class with no note in view.
3. Add images: a currency note dataset from Kaggle plus extra webcam captures in real lighting. Mixing both works much better than dataset images alone.
4. Train, test in the preview, then use **Export Model > TensorFlow.js > Download**.
5. Place `model.json`, `metadata.json` and `weights.bin` in the repository, next to `index.html`.

Class names are spoken exactly as written. To change what is spoken, edit `LABEL_SPEECH` in `script.js`:

```js
LABEL_SPEECH: { en: { '10 Rupee Note': 'ten rupee note' }, hi: {} }
```

## Settings you can tune

At the top of `script.js` there is a `CONFIG` block:

| Setting | Meaning |
|---------|---------|
| `LOCAL_MODEL_DIRS` | Folders searched for the custom model (default: main folder, then `./model/`) |
| `REMOTE_MODEL_URL` | Optional Teachable Machine shareable link, used if no local model is found |
| `CUSTOM_THRESHOLD` | How sure the currency model must be before speaking (default 0.85) |
| `CONFIRM_FRAMES` | Times an object must be seen in a row before it is announced |
| `FOCAL_FACTOR` | Camera field-of-view assumption for distance; adjust if distances feel consistently off |
| `DANGER_M`, `GUIDE_M` | Distances (metres) that trigger an urgent warning or movement guidance |

---

## Limitations

- **Distances are estimates.** A single camera cannot measure real depth. Drishti infers it from object size, so values are approximate and reported in coarse steps.
- COCO-SSD knows about 80 object types. Things like stairs, doors and walls are not detected by the base model.
- The currency model is only as good as its training data. Lighting, folded notes and worn notes can reduce accuracy.
- Hindi speech needs a Hindi voice installed on the device. Otherwise the browser uses its default voice.
- The first load downloads the models (a few MB), so an internet connection is needed the first time.

## Safety

Drishti is an assistive **prototype**. Objects can be missed and distances can be wrong. It is **not a replacement** for a white cane, a guide dog or a human guide.

## Future work

- Detect stairs, doors, pedestrian crossings and wet-floor signs with additional custom models.
- Use a depth-estimation model for better distance accuracy.
- Add haptic (vibration) feedback and voice commands.
- Support more Indian languages.

---

Built by Anurag ([@Anurag-26112007](https://github.com/Anurag-26112007)) for Coding Connoisseurs, Faculty of Engineering and Technology, University of Lucknow.
