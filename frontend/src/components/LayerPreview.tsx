import "./LayerPreview.css";

interface Layer {
  layer: number;
  image: string;
  segment_count: number;
}

interface Props {
  layers: Layer[];
  segmentsFound: number;
}

export default function LayerPreview({ layers, segmentsFound }: Props) {
  return (
    <div className="layer-preview">
      <h2>Layer Preview</h2>
      <p className="info">
        {segmentsFound} pixels split into {layers.length} layers
      </p>

      {/* Combined 3D View */}
      <div className="combined-section">
        <h3>Combined Stack Preview</h3>
        <div className="combined-container">
          <div className="stack-3d">
            {layers.map((layer, index) => (
              <div
                key={layer.layer}
                className="stacked-layer"
                style={{
                  zIndex: layers.length - index,
                  transform: `translateY(${index * -2}px) translateX(${index * 1}px) rotateX(2deg)`,
                  filter: "opacity(1)",
                }}
              >
                <img
                  src={layer.image}
                  alt={`Layer ${layer.layer + 1}`}
                  style={{ opacity: 0.6 }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Individual Layers */}
      <div className="individual-section">
        <h3>Individual Layers</h3>
        <div className="layers">
          {layers.map((layer) => (
            <div key={layer.layer} className="layer">
              <h4>Layer {layer.layer + 1}</h4>
              <p className="segment-count">
                {layer.segment_count.toLocaleString()} pixels
              </p>
              <img src={layer.image} alt={`Layer ${layer.layer + 1}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
