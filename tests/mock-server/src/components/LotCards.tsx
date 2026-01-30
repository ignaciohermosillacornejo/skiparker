import { getScenario } from '../scenario';

interface LotCardsProps {
  onLotSelect: (lotName: string) => void;
}

export default function LotCards({ onLotSelect }: LotCardsProps) {
  const lots = getScenario().lots ?? [];

  return (
    <div className="SelectZone_wrapper__a1b2c">
      {lots.map((lot) => (
        <div
          key={lot}
          className="SelectZone_card__d3e4f"
          onClick={() => onLotSelect(lot)}
        >
          {lot}
        </div>
      ))}
    </div>
  );
}
