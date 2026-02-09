// App.jsx
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const API_BASE = "http://localhost:5000";

// Two zoom levels like FastStone
const ZOOMED_SCALE = 2.25; // change to 2, 2.5, 3, etc.

// Country list (from: https://gist.github.com/kalinchernev/486393efcca01623b18d)
const COUNTRIES = [
  "Afghanistan","Albania","Algeria","American Samoa","Andorra","Angola","Anguilla","Antarctica","Antigua and Barbuda",
  "Argentina","Armenia","Aruba","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus",
  "Belgium","Belize","Benin","Bermuda","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Bouvet Island","Brazil",
  "British Indian Ocean Territory","Brunei Darussalam","Bulgaria","Burkina Faso","Burundi","Cambodia","Cameroon","Canada",
  "Cape Verde","Cayman Islands","Central African Republic","Chad","Chile","China","Christmas Island","Cocos (Keeling) Islands",
  "Colombia","Comoros","Congo","Congo, The Democratic Republic of The","Cook Islands","Costa Rica","Cote D'ivoire","Croatia",
  "Cuba","Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador",
  "Equatorial Guinea","Eritrea","Estonia","Ethiopia","Falkland Islands (Malvinas)","Faroe Islands","Fiji","Finland","France",
  "French Guiana","French Polynesia","French Southern Territories","Gabon","Gambia","Georgia","Germany","Ghana","Gibraltar",
  "Greece","Greenland","Grenada","Guadeloupe","Guam","Guatemala","Guinea","Guinea-bissau","Guyana","Haiti",
  "Heard Island and Mcdonald Islands","Holy See (Vatican City State)","Honduras","Hong Kong","Hungary","Iceland","India",
  "Indonesia","Iran, Islamic Republic of","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya",
  "Kiribati","Korea, Democratic People's Republic of","Korea, Republic of","Kuwait","Kyrgyzstan","Lao People's Democratic Republic",
  "Latvia","Lebanon","Lesotho","Liberia","Libyan Arab Jamahiriya","Liechtenstein","Lithuania","Luxembourg","Macao","Macedonia, The Former Yugoslav Republic of",
  "Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Martinique","Mauritania","Mauritius","Mayotte",
  "Mexico","Micronesia, Federated States of","Moldova, Republic of","Monaco","Mongolia","Montenegro","Montserrat","Morocco","Mozambique","Myanmar",
  "Namibia","Nauru","Nepal","Netherlands","Netherlands Antilles","New Caledonia","New Zealand","Nicaragua","Niger","Nigeria",
  "Niue","Norfolk Island","Northern Mariana Islands","Norway","Oman","Pakistan","Palau","Palestinian Territory, Occupied","Panama",
  "Papua New Guinea","Paraguay","Peru","Philippines","Pitcairn","Poland","Portugal","Puerto Rico","Qatar","Reunion","Romania",
  "Russian Federation","Rwanda","Saint Helena","Saint Kitts and Nevis","Saint Lucia","Saint Pierre and Miquelon",
  "Saint Vincent and The Grenadines","Samoa","San Marino","Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles",
  "Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Georgia and The South Sandwich Islands",
  "Spain","Sri Lanka","Sudan","Suriname","Svalbard and Jan Mayen","Swaziland","Sweden","Switzerland","Syrian Arab Republic",
  "Taiwan, Province of China","Tajikistan","Tanzania, United Republic of","Thailand","Timor-leste","Togo","Tokelau","Tonga",
  "Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Turks and Caicos Islands","Tuvalu","Uganda","Ukraine","United Arab Emirates",
  "United Kingdom","United States","United States Minor Outlying Islands","Uruguay","Uzbekistan","Vanuatu","Venezuela","Viet Nam",
  "Virgin Islands, British","Virgin Islands, U.S.","Wallis and Futuna","Western Sahara","Yemen","Zambia","Zimbabwe"
];


const Field = ({ label, children }) => (
  <div style={{ marginBottom: 12, textAlign: "left" }}>
    <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
    {children}
  </div>
);

const App = () => {
  const [referenceImage, setReferenceImage] = useState("");
  const [evaluatedImage, setEvaluatedImage] = useState("");
  const [ratings, setRatings] = useState({ realism: 0, quality: 0 });

  // expanded demographics state
  const [demographics, setDemographics] = useState({
    age: "",
    gender: "",
    email: "",
    selfDescription: "", // Regular person / Photographer / Imaging Expert
    visionStatus: "", // No ordinary / No corrected / Yes
    visionDetails: "", // only required when visionStatus === "Yes"
    colorBlind: "", // Yes / No
    countryOfOrigin: "",
    displayType: "", // Laptop / External Monitor
    lighting: "", // Dim / Normal indoor / Outdoor
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
    const {
      age,
      gender,
      email,
      selfDescription,
      visionStatus,
      visionDetails,
      colorBlind,
      countryOfOrigin,
      displayType,
      lighting,
    } = demographics;

    // required fields
    if (
      !age ||
      !gender ||
      !email ||
      !selfDescription ||
      !visionStatus ||
      !colorBlind ||
      !countryOfOrigin ||
      !displayType ||
      !lighting
    ) {
      alert("Please fill out all required demographic fields.");
      return;
    }

    // conditional: vision details required if "Yes"
    if (visionStatus === "Yes" && !visionDetails.trim()) {
      alert("Please provide details about your vision degradation.");
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
        demographics, // includes new fields
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
    const isVisionYes = demographics.visionStatus === "Yes";
    const inputStyle = { width: "100%", padding: "8px" };
    const selectStyle = { width: "100%", padding: "8px" };

    return (
      <div
        style={{
          maxWidth: 780,
          margin: "30px auto",
          padding: "18px",
          textAlign: "center",
        }}
      >
        <h2 style={{ marginBottom: 12 }}>User Demographics</h2>

        {/* Two-column grid, collapses naturally on small screens */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Age *">
            <input
              type="number"
              name="age"
              value={demographics.age}
              onChange={handleDemographicsChange}
              style={inputStyle}
            />
          </Field>

          <Field label="Gender *">
            <select
              name="gender"
              value={demographics.gender}
              onChange={handleDemographicsChange}
              style={selectStyle}
            >
              <option value="">Select</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </Field>

          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Email *">
              <input
                type="email"
                name="email"
                value={demographics.email || ""}
                onChange={handleDemographicsChange}
                style={inputStyle}
                placeholder="you@example.com"
              />
            </Field>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="How would you describe yourself? *">
              <select
                name="selfDescription"
                value={demographics.selfDescription}
                onChange={handleDemographicsChange}
                style={selectStyle}
              >
                <option value="">Select</option>
                <option value="Regular person">Regular person</option>
                <option value="Photographer / Imaging Expert">
                  Photographer / Imaging Expert
                </option>
              </select>
            </Field>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Is your vision degraded? *">
              <select
                name="visionStatus"
                value={demographics.visionStatus}
                onChange={(e) => {
                  const { value } = e.target;
                  setDemographics((prev) => ({
                    ...prev,
                    visionStatus: value,
                    ...(value !== "Yes" ? { visionDetails: "" } : {}),
                  }));
                }}
                style={selectStyle}
              >
                <option value="">Select</option>
                <option value="No - Ordinary vision">No - Ordinary vision</option>
                <option value="No because of correction with glasses/contact lenses/surgery">
                  No because of correction with glasses/contact lenses/surgery
                </option>
                <option value="Yes">Yes, provide details</option>
              </select>
            </Field>
          </div>

          {isVisionYes && (
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Vision details *">
                <textarea
                  name="visionDetails"
                  value={demographics.visionDetails}
                  onChange={handleDemographicsChange}
                  style={{ ...inputStyle, minHeight: 70 }}
                  placeholder="Provide details about your vision."
                />
              </Field>
            </div>
          )}

          <Field label="Color blindness? *">
            <select
              name="colorBlind"
              value={demographics.colorBlind}
              onChange={handleDemographicsChange}
              style={selectStyle}
            >
              <option value="">Select</option>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
          </Field>

          <Field label="Country of origin *">
            <select
              name="countryOfOrigin"
              value={demographics.countryOfOrigin}
              onChange={handleDemographicsChange}
              style={selectStyle}
            >
              <option value="">Select</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="What kind of display? *">
            <select
              name="displayType"
              value={demographics.displayType}
              onChange={handleDemographicsChange}
              style={selectStyle}
            >
              <option value="">Select</option>
              <option value="Laptop">Laptop</option>
              <option value="External Monitor">External Monitor</option>
            </select>
          </Field>

          <Field label="What kind of lighting? *">
            <select
              name="lighting"
              value={demographics.lighting}
              onChange={handleDemographicsChange}
              style={selectStyle}
            >
              <option value="">Select</option>
              <option value="Dim Light">Dim Light</option>
              <option value="Normal Indoor Lighting">Normal Indoor Lighting</option>
              <option value="Outdoor Lighting (not recommended)">
                Outdoor Lighting (not recommended)
              </option>
            </select>
          </Field>
        </div>

        <div style={{ marginTop: 14 }}>
          <button
            onClick={submitDemographics}
            style={{
              padding: "12px 20px",
              fontSize: "16px",
              cursor: "pointer",
              backgroundColor: "#007BFF",
              color: "white",
              border: "none",
              borderRadius: "6px",
              width: "100%",
              maxWidth: 280,
            }}
          >
            Continue
          </button>
          <div style={{ marginTop: 10, fontSize: 12, color: "#555" }}>
            * Required fields
          </div>
        </div>
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
      {/* Compact progress row: label left, bar middle, count right */}
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

        <progress value={completed} max={totalImages} style={{ width: "100%", height: 12 }} />

        <div style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
          {completed}/{totalImages}
        </div>
      </div>

      {/* Shared zoom/pan wrapper for BOTH images */}
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
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
              {/* Controls */}
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <button onClick={() => resetTransform(150)} style={{ padding: "6px 10px", cursor: "pointer" }}>
                  100%
                </button>

                <button onClick={() => applyScale(ZOOMED_SCALE)} style={{ padding: "6px 10px", cursor: "pointer" }}>
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
                <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%" }}>
                  <div style={{ display: "flex", width: "100%", height: "100%" }}>
                    {/* Left */}
                    <div style={{ flex: 1, padding: 10 }}>
                      <div style={{ fontWeight: "bold", marginBottom: 6 }}>Reference Image</div>
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
                      <div style={{ fontWeight: "bold", marginBottom: 6 }}>Evaluated Image</div>
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

      {/* Centered instruction sentence */}
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

      {/* One-line ratings bar */}
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
        <div style={{ fontWeight: 700, whiteSpace: "nowrap" }}>Rate evaluated image (1–5)</div>

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
                    backgroundColor: ratings.realism === score ? "#4caf50" : "#f0f0f0",
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
                    backgroundColor: ratings.quality === score ? "#4caf50" : "#f0f0f0",
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
