import { useNavigate } from 'react-router-dom';

export default function RateCards() {
  const navigate = useNavigate();

  function handleCardClick(type: string) {
    navigate(`/checkout/${Date.now()}?type=${type}`);
  }

  return (
    <div className="SelectRate_wrapper__v6wva">
      <div className="SelectRate_card__AT83w" onClick={() => handleCardClick('carpool')}>
        <div className="SelectRate_rateCopy__yfcwz">
          <div>Carpool 4+ Arrival 7am - 10am, valid for all day parking</div>
        </div>
        <div className="SelectRate_priceArrowWrapper__lX7gS">
          <div className="SelectRate_ratePrice__r2+hE">$0</div>
        </div>
      </div>
      <div className="SelectRate_card__AT83w" onClick={() => handleCardClick('paid')}>
        <div className="SelectRate_rateCopy__yfcwz">
          <div>Advanced Paid Reservations 7am - 10am, valid for all day parking ($20 flat rate plus taxes &amp; fees)</div>
        </div>
        <div className="SelectRate_priceArrowWrapper__lX7gS">
          <div className="SelectRate_ratePrice__r2+hE">$23.41</div>
        </div>
      </div>
    </div>
  );
}
