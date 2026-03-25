import "./LayersInput.css";

interface Props {
  value: number;
  onValueChange: (value: number) => void;
}

export default function LayersInput({ value, onValueChange }: Props) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const newValue = parseInt(event.target.value, 10);
    if (!isNaN(newValue) && newValue > 0) {
      onValueChange(newValue);
    }
  }

  return (
    <div className="layers-input">
      <label htmlFor="layers">Number of Layers:</label>
      <input
        id="layers"
        type="number"
        min="1"
        value={value}
        onChange={handleChange}
      />
    </div>
  );
}
