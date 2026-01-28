import { useState } from 'react';
import Calendar from '../components/Calendar';
import RateCards from '../components/RateCards';

export default function SelectParking() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  function handleDateSelect(dateStr: string) {
    setSelectedDate(dateStr);
  }

  const formattedDate = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).toUpperCase()
    : null;

  return (
    <div className="d-flex flex-column h-100">
      <div className="flex-1 Layout_body__aaMuJ">
        <div className="h-100">
          <nav className="Nav_navbar__TXHws">
            <div className="Nav_leftButtonContainer__h-ayJ">
              <button type="button" className="Nav_leftButton__CgBNa">Back</button>
            </div>
            <a className="Nav_title__veio4" href="/">Park Stevens Pass</a>
            <div className="Nav_rightButtonContainer__cl3Yp">
              <a className="Nav_loginProfileLink__LO94z" href="/settings">
                <i className="bi-list Nav_hamburgerIcon__AToZp"></i>
              </a>
            </div>
          </nav>
          <div className="ParkingSelection_container__FGMbo">
            <div className="ParkingSelection_title__4oBPN">Reserve a parking spot</div>

            <div className="h-100">
              <div>
                <div className="ExpandableCard_titleBox__5k2mD ExpandableCard_disabled__w5wtI">
                  <div>
                    <div>1. Parking location</div>
                    <div className="ExpandableCard_subtitle__s0l-O">STEVENS PASS</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-100">
              <div>
                <div className={`ExpandableCard_titleBox__5k2mD ${selectedDate ? 'ExpandableCard_disabled__w5wtI' : 'ExpandableCard_active__hfFDY'}`}>
                  <div>
                    <div>2. Date</div>
                    {formattedDate && (
                      <div className="ExpandableCard_subtitle__s0l-O">{formattedDate}</div>
                    )}
                  </div>
                  {selectedDate && (
                    <button
                      className="ExpandableCard_button__dLT0V"
                      type="button"
                      onClick={() => setSelectedDate(null)}
                    >
                      Change Date
                    </button>
                  )}
                </div>
                {!selectedDate && (
                  <div className="ExpandableCard_animatedContainer__wWkUk ExpandableCard_containerActive__4XZKA">
                    <Calendar onDateSelect={handleDateSelect} />
                    <div className="SelectDate_availability__IccV4">
                      <div className="SelectDate_available__FuxXF">Available</div>
                      <div className="SelectDate_soldOut__4YEX8">Sold out</div>
                      <div className="SelectDate_unavailable__buZj7">Unavailable</div>
                      <div className="SelectDate_noReservation__C7oHz">No reservation needed</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="ParkingSelection_changeDay__432Cj">
              <button type="button">&lt; Previous Day</button>
              <button type="button">Next Day &gt;</button>
            </div>

            <div className="h-100">
              <div>
                <div className={`ExpandableCard_titleBox__5k2mD ${selectedDate ? 'ExpandableCard_active__hfFDY' : ''}`}>
                  <div>
                    <div>3. Parking rate</div>
                  </div>
                </div>
                {selectedDate && (
                  <div className="ExpandableCard_animatedContainer__wWkUk ExpandableCard_containerActive__4XZKA">
                    <RateCards />
                  </div>
                )}
              </div>
            </div>

            <div className="ParkingSelection_redeemCodeWrapper__tjsBv">
              Got a parking code?
              <a className="ParkingSelection_redeemCodeLink__-b3s4" href="/code">Redeem your code</a>
            </div>
          </div>
        </div>
      </div>
      <footer className="Footer_footer__HSC7C">
        <div className="d-flex flex-column align-items-center">
          <span>Powered by HONK</span>
        </div>
      </footer>
    </div>
  );
}
