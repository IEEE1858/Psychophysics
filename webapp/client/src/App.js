// App.jsx
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const API_BASE = "http://localhost:5000";

// Two zoom levels like FastStone
const ZOOMED_SCALE = 2.25; // change to 2, 2.5, 3, etc.

const App = () => {
  const [referenceImage, setReferenceImage] = useState("");
  const [evaluatedImage, setEvaluatedImage] = useState("");
  const [ratings, setRatings] = useState({ realism: 0, quality: 0 });

  const [demographics, setDemographics] = useState({
    age: "",
    gender: "",
    email: "",
  });
  const [demographicsSubmitted, setDemographicsSubmitted] = useState(false);

  const [ratedImages, setRatedImages] = useState(new Set());
  const [allImagesMap, setAllImagesMap] = useState({});
  const [remainingCount, setRemainingCount] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // Flatten all pairs (memoized)
  const allPairs = useMemo(() => {
    return Object.entries(allImagesMap).flatMap(([ref, evals]) =>
      (evals || []).map((ev) => ({ reference: ref, evaluated: ev }))
    );
  }, [allImagesMap]);

  useEffect(() => {
    const fetchAllImages = async () => {
      try {
        const res = await axios.get(`${API_BASE}/image-map`);
        setAllImagesMap(res.data);

        const totalEvaluated = Object.values(res.data).flat().length;
        setTotalImages(totalEvaluated);
        setRemainingCount(totalEvaluated);
      } catch (err) {
        console.error("Error fetching image map:", err);
      }
    };

    fetchAllImages();
  }, []);

  const fetchNextImage = () => {
    const unrated = allPairs.filter((img) => !ratedImages.has(img.evaluated));

    if (unrated.length === 0) {
      setIsFinished(true);
      return;
    }

    const next = unrated[Math.floor(Math.random() * unrated.length)];
    setReferenceImage(next.reference);
    setEvaluatedImage(next.evaluated);
    setRatings({ realism: 0, quality: 0 });
    setRemainingCount(unrated.length - 1);
  };

  const handleDemographicsChange = (e) => {
    const { name, value } = e.target;
    setDemographics((prev) => ({ ...prev, [name]: value }));
  };

  const submitDemographics = () => {
    const { age, gender, email } = demographics;
    if (!age || !gender || !email) {
      alert("Please fill out all demographic fields.");
      return;
    }
    setDemographicsSubmitted(true);
    fetchNextImage();
  };

  const handleRatingChange = (question, score) => {
    setRatings((prev) => ({ ...prev, [question]: score }));
  };

  const submitFinalRating = async () => {
    if (ratings.realism === 0 || ratings.quality === 0) {
      alert("Please rate both realism and quality.");
      return;
    }

    try {
      const payload = {
        imageUrl: evaluatedImage,
        ratings,
        demographics,
      };

      await axios.post(`${API_BASE}/submit-rating`, payload);

      setRatedImages((prev) => {
        const next = new Set(prev);
        next.add(evaluatedImage);
        return next;
      });

      fetchNextImage();
    } catch (error) {
      console.error(
        "Error submitting rating:",
        error.response?.status,
        error.response?.data || error.message
      );
      alert("Error submitting. Please try again.");
    }
  };

  // Show demographics form if not submitted
  if (!demographicsSubmitted) {
    return (
      <div
        style={{
          maxWidth: "500px",
          margin: "50px auto",
          padding: "20px",
          textAlign: "center",
        }}
      >
        <h2>User Demographics</h2>

        <div style={{ marginBottom: "15px" }}>
          <label>Age: </label>
          <input
            type="number"
            name="age"
            value={demographics.age}
            onChange={handleDemographicsChange}
            style={{ width: "100%", padding: "8px" }}
          />
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label>Gender: </label>
          <select
            name="gender"
            value={demographics.gender}
            onChange={handleDemographicsChange}
            style={{ width: "100%", padding: "8px" }}
          >
            <option value="">Select</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Non-binary">Non-binary</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label>Email: </label>
          <input
            type="email"
            name="email"
            value={demographics.email || ""}
            onChange={handleDemographicsChange}
            style={{ width: "100%", padding: "8px" }}
            placeholder="you@example.com"
          />
        </div>

        <button
          onClick={submitDemographics}
          style={{
            padding: "12px 20px",
            fontSize: "16px",
            cursor: "pointer",
            backgroundColor: "#007BFF",
            color: "white",
            border: "none",
            borderRadius: "5px",
          }}
        >
          Continue
        </button>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <h2>🎉 Thank You!</h2>
        <p>You have completed all image ratings.</p>
      </div>
    );
  }

  const completed = totalImages - remainingCount;

  return (
    <div style={{ textAlign: "center", padding: "8px 12px" }}>
      {/* ✅ Compact progress row: label left, bar middle, count right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          maxWidth: 1700,
          margin: "6px auto 6px",
        }}
      >
        <div style={{ fontWeight: 700, whiteSpace: "nowrap" }}>Progress</div>

        <progress
          value={completed}
          max={totalImages}
          style={{ width: "100%", height: 12 }}
        />

        <div style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
          {completed}/{totalImages}
        </div>
      </div>

      {/* Shared zoom/pan wrapper for BOTH images */}
      <TransformWrapper
        initialScale={1}
        minScale={0.5} // ✅ allow smaller than 100%
        maxScale={6}
        centerOnInit
        wheel={{ step: 0.15 }}
        panning={{ velocityDisabled: true }}
        doubleClick={{ mode: "toggle" }}
      >
        {({ resetTransform, setTransform, state }) => {
          const safe = state ?? { positionX: 0, positionY: 0, scale: 1 };

          const zoomStep = 0.25;
          const minScale = 0.5;
          const maxScale = 6;

          const applyScale = (nextScale) => {
            const clamped = Math.max(minScale, Math.min(maxScale, nextScale));
            setTransform(safe.positionX, safe.positionY, clamped, 120);
          };

          return (
            <>
              {/* ✅ tighter controls row */}
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => resetTransform(150)}
                  style={{ padding: "6px 10px", cursor: "pointer" }}
                >
                  100%
                </button>

                <button
                  onClick={() => applyScale(ZOOMED_SCALE)}
                  style={{ padding: "6px 10px", cursor: "pointer" }}
                >
                  Zoom
                </button>

                <button
                  onClick={() => applyScale((safe.scale ?? 1) + zoomStep)}
                  style={{ padding: "6px 10px", cursor: "pointer" }}
                >
                  +
                </button>

                <button
                  onClick={() => applyScale((safe.scale ?? 1) - zoomStep)}
                  style={{ padding: "6px 10px", cursor: "pointer" }}
                >
                  -
                </button>
              </div>

              {/* Zoomable area */}
              <div
                style={{
                  marginTop: 10,
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  overflow: "hidden",
                  width: "95vw",
                  maxWidth: 1700,
                  height: "68vh",
                  marginLeft: "auto",
                  marginRight: "auto",
                  background: "#fafafa",
                }}
              >
                <TransformComponent
                  wrapperStyle={{ width: "100%", height: "100%" }}
                  contentStyle={{ width: "100%", height: "100%" }}
                >
                  <div style={{ display: "flex", width: "100%", height: "100%" }}>
                    {/* Left */}
                    <div style={{ flex: 1, padding: 10 }}>
                      <div style={{ fontWeight: "bold", marginBottom: 6 }}>
                        Reference Image
                      </div>
                      <img
                        src={referenceImage || "https://via.placeholder.com/800"}
                        alt="Reference"
                        draggable={false}
                        style={{
                          width: "100%",
                          height: "calc(100% - 22px)",
                          objectFit: "contain",
                          userSelect: "none",
                          pointerEvents: "none",
                        }}
                      />
                    </div>

                    <div style={{ width: 2, background: "#ddd" }} />

                    {/* Right */}
                    <div style={{ flex: 1, padding: 10 }}>
                      <div style={{ fontWeight: "bold", marginBottom: 6 }}>
                        Evaluated Image
                      </div>
                      <img
                        src={evaluatedImage || "https://via.placeholder.com/800"}
                        alt="Evaluated"
                        draggable={false}
                        style={{
                          width: "100%",
                          height: "calc(100% - 22px)",
                          objectFit: "contain",
                          userSelect: "none",
                          pointerEvents: "none",
                        }}
                      />
                    </div>
                  </div>
                </TransformComponent>
              </div>
            </>
          );
        }}
      </TransformWrapper>

      {/* ✅ Centered instruction sentence (as requested) */}
      <div
        style={{
          maxWidth: 1700,
          margin: "12px auto 8px",
          textAlign: "center",
          fontSize: "16px",
          fontWeight: 600,
        }}
      >
        How would you rate the quality and realism of the evaluated image?
      </div>

      {/* ✅ One-line ratings bar: label left, ratings middle, submit right */}
      <div
        style={{
          maxWidth: 1700,
          margin: "6px auto 0",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        {/* Left label */}
        <div style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
          Rate evaluated image (1–5)
        </div>

        {/* Middle: Realism + Quality */}
        <div
          style={{
            display: "flex",
            gap: 40,
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            flex: 1,
          }}
        >
          {/* Realism */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ whiteSpace: "nowrap", fontWeight: 600 }}>Realism</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={`realism-${score}`}
                  onClick={() => handleRatingChange("realism", score)}
                  style={{
                    padding: "6px 10px",
                    fontSize: 14,
                    backgroundColor:
                      ratings.realism === score ? "#4caf50" : "#f0f0f0",
                    cursor: "pointer",
                    borderRadius: 6,
                    border: "1px solid #ccc",
                  }}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ whiteSpace: "nowrap", fontWeight: 600 }}>Quality</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={`quality-${score}`}
                  onClick={() => handleRatingChange("quality", score)}
                  style={{
                    padding: "6px 10px",
                    fontSize: 14,
                    backgroundColor:
                      ratings.quality === score ? "#4caf50" : "#f0f0f0",
                    cursor: "pointer",
                    borderRadius: 6,
                    border: "1px solid #ccc",
                  }}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right submit */}
        <button
          onClick={submitFinalRating}
          style={{
            padding: "10px 16px",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            backgroundColor: "#007BFF",
            color: "white",
            border: "none",
            borderRadius: 8,
            whiteSpace: "nowrap",
          }}
        >
          Submit
        </button>
      </div>
    </div>
  );
};

export default App;