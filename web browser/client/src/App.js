import React, { useState, useEffect } from "react";
import axios from "axios";

const App = () => {
  const [referenceImage, setReferenceImage] = useState("");
  const [evaluatedImage, setEvaluatedImage] = useState("");
  const [ratings, setRatings] = useState({ realism: 0, quality: 0 });

  const [demographics, setDemographics] = useState({ age: "", gender: "", email: "" });
  const [demographicsSubmitted, setDemographicsSubmitted] = useState(false);

  const [ratedImages, setRatedImages] = useState(new Set());
  const [allImagesMap, setAllImagesMap] = useState({});
  const [remainingCount, setRemainingCount] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    // Load all image pairs from backend imageMap logic
    const fetchAllImages = async () => {
      try {
        const res = await axios.get("http://localhost:5000/image-map");
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
    // Flatten all image pairs
    const entries = Object.entries(allImagesMap).flatMap(([ref, evals]) =>
      evals.map((ev) => ({ reference: ref, evaluated: ev }))
    );

    const unrated = entries.filter((img) => !ratedImages.has(img.evaluated));

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

      await axios.post("http://localhost:5000/submit-rating", payload);

      setRatedImages((prev) => new Set(prev).add(evaluatedImage));
      fetchNextImage();
    } catch (error) {
      console.error("Error submitting rating:", error);
      alert("Error submitting. Please try again.");
    }
  };

  // Show demographics form if not submitted
  if (!demographicsSubmitted) {
    return (
      <div style={{ maxWidth: "500px", margin: "50px auto", padding: "20px", textAlign: "center" }}>
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
          <select name="gender" value={demographics.gender} onChange={handleDemographicsChange} style={{ width: "100%", padding: "8px" }}>
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
        <button onClick={submitDemographics} style={{ padding: "12px 20px", fontSize: "16px", cursor: "pointer", backgroundColor: "#007BFF", color: "white", border: "none", borderRadius: "5px" }}>
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

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h3>Progress: {totalImages - remainingCount} / {totalImages}</h3>
      <progress value={totalImages - remainingCount} max={totalImages} style={{ width: "80%" }}></progress>

      <div style={{ display: "flex", justifyContent: "center", gap: "30px", marginTop: "30px" }}>
          {/* Reference Image */}
          <div style={{ textAlign: "center", flex: 1 }}>
          <p style={{ fontWeight: "bold", marginBottom: "10px" }}>Reference Image</p>
          <img
            src={referenceImage || "https://via.placeholder.com/400"}
            alt="Reference"
            style={{ width: "100%", maxWidth: "1300px", height: "auto" }}
          />
        </div>

        {/* Evaluated Image and Ratings */}
        <div style={{ textAlign: "center", flex: 1 }}>
          <p style={{ fontWeight: "bold", marginBottom: "10px" }}>Evaluated Image</p>
          <img
            src={evaluatedImage || "https://via.placeholder.com/400"}
            alt="Evaluated"
            style={{ width: "100%", maxWidth: "1300px", height: "auto" }}
          />

          {/* Ratings Section */}
          <div style={{ marginTop: "30px" }}>
            <p style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "-10px" }}>
              Rate the evaluated image (1 = Worst, 5 = Best)
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: "50px", marginTop: "20px" }}>
              {/* Realism Rating */}
              <div style={{ textAlign: "center" }}>
                <p style={{ marginBottom: "10px" }}>How realistic does the evaluated image appear?</p>
                <div style={{ display: "flex", justifyContent: "center", gap: "5px" }}>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={`realism-${score}`}
                      onClick={() => handleRatingChange("realism", score)}
                      style={{
                        padding: "10px",
                        fontSize: "14px",
                        backgroundColor: ratings.realism === score ? "#4caf50" : "#f0f0f0",
                        cursor: "pointer",
                        borderRadius: "5px",
                      }}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality Rating */}
              <div style={{ textAlign: "center" }}>
                <p style={{ marginBottom: "10px" }}>How high is the quality of the evaluated image?</p>
                <div style={{ display: "flex", justifyContent: "center", gap: "5px" }}>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={`quality-${score}`}
                      onClick={() => handleRatingChange("quality", score)}
                      style={{
                        padding: "10px",
                        fontSize: "14px",
                        backgroundColor: ratings.quality === score ? "#4caf50" : "#f0f0f0",
                        cursor: "pointer",
                        borderRadius: "5px",
                      }}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ marginTop: "20px", display: "flex", justifyContent: "center" }}>
              <button
                onClick={submitFinalRating}
                style={{
                  padding: "15px 30px",
                  fontSize: "18px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  backgroundColor: "#007BFF",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;