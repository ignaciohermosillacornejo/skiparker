import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getScenario } from '../scenario';
import ConfirmModal from '../components/ConfirmModal';
import ConflictModal from '../components/ConflictModal';
import ErrorPage from '../components/ErrorPage';

export default function Checkout() {
  const scenario = getScenario();
  const [searchParams] = useSearchParams();
  const isPaid = searchParams.get('type') === 'paid';
  const [termsAccepted, setTermsAccepted] = useState(isPaid); // paid has no terms checkbox
  const [showModal, setShowModal] = useState<'confirm' | 'overlap' | 'limit' | null>(null);

  function handleContinue() {
    setShowModal(scenario.checkoutOutcome);
  }

  if (showModal === 'limit') {
    return <ErrorPage />;
  }

  return (
    <>
      <div className="CheckoutRoute">
        <div className="CheckoutZoneDetails">
          <h2 className="CheckoutZoneDetails--address">Stevens Pass, Stevens Pass, WA</h2>
          Zone STEVENSPASS
        </div>
        <div className="CheckoutRoute--operatorBanner center">
          <p>Operated by Stevens Pass</p>
        </div>
        <div className="ui padded centered grid">
          <div className="CheckoutRoute--container eight wide computer sixteen wide mobile column">
            <div className="ui basic segment CheckoutRoute--purchaseSummary">
              <button className="PlainButton--noStyle CheckoutSummaryItem" type="button" aria-label="Edit vehicle">
                <div className="CheckoutSummaryItem--left">
                  <div className="CheckoutSummaryItem--image"></div>
                  <div className="CheckoutSummaryItem--copyBlock">
                    <div className="CheckoutSummaryItem--label">Plate Number</div>
                    <div className="CheckoutSummaryItem--content">
                      <div className="CheckoutVehicleComponent--plate">{scenario.plate}</div>
                    </div>
                  </div>
                </div>
              </button>
              <div>
                <div className="CheckoutSummaryItem">
                  <div className="CheckoutSummaryItem--left">
                    <div className="CheckoutSummaryItem--copyBlock">
                      <div className="CheckoutSummaryItem--label">Start</div>
                      <div className="CheckoutSummaryItem--content">
                        <div className="DateTimeDisplayComponent--dateContent">
                          Sat Feb 14, 2026 (<span className="DateTimeDisplayComponent--timeContent">6:00AM </span>PST)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="CheckoutSummaryItem">
                  <div className="CheckoutSummaryItem--left">
                    <div className="CheckoutSummaryItem--copyBlock">
                      <div className="CheckoutSummaryItem--label">End</div>
                      <div className="CheckoutSummaryItem--content">
                        <div className="DateTimeDisplayComponent--dateContent">
                          Sat Feb 14, 2026 (<span className="DateTimeDisplayComponent--timeContent">10:05AM </span>PST)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <hr className="CheckoutRoute--rule" />
            <div className="CheckoutPriceBreakdown">
              <div className="CheckoutPriceBreakdown--row">
                <div>Parking<span>(Tax Incl)</span></div>
                <div>{isPaid ? '$21.24' : '$0.00'}</div>
              </div>
              <div className="CheckoutPriceBreakdown--row">
                <div>Service Fee</div>
                <div>{isPaid ? '$2.17' : '$0.00'}</div>
              </div>
              <div className="CheckoutPriceBreakdown--row">
                <div className="CheckoutPriceBreakdown--total">Total</div>
                <div className="CheckoutPriceBreakdown--total">{isPaid ? '$23.41' : '$0.00'}</div>
              </div>
            </div>
            {!isPaid && (
              <div className="AcceptTermsCheckBox--wrapper">
                <div className="AcceptTermsCheckBox--inner-wrapper text">
                  <p>This parking location requires a credit card to secure this reservation. All credit card information will be processed securely. No-shows may be subject to a charge of $50 per reservation. <a href="#">Terms and Conditions</a></p>
                </div>
                <hr />
                <div className="AcceptTermsCheckBox--inner-wrapper">
                  <div className="CheckboxComponent field">
                    <div className="ui checkbox">
                      <input
                        id="terms"
                        className="CheckboxComponent--input"
                        name="terms"
                        aria-label="Accept terms and conditions checkbox"
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                      />
                      <label htmlFor="terms" className="CheckboxComponent--label">
                        <div className="AcceptTermsCheckBox--label">
                          <span>I accept Terms and Conditions</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <button className="PlainButton--noStyle SelectPaymentMethodButton--wrapper" type="button">
              <div className="dimmable">
                <div className="SelectPaymentMethodButton--container">
                  <div className="SelectPaymentMethodButton--body">Pay with Visa 5559</div>
                </div>
              </div>
            </button>
            <button
              className={`PlainButton--noStyle CtaButton--container CtaButton--container__shadow${termsAccepted ? '' : ' CtaButton--container__disabled'}`}
              type="button"
              onClick={termsAccepted ? handleContinue : undefined}
            >
              <div className="ui basic center aligned segment">
                <div className="ui inverted loader"></div>
                <div>{isPaid ? 'Pay $23.41 & Park' : 'Continue'}</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {showModal === 'confirm' && (
        <ConfirmModal onClose={() => setShowModal(null)} />
      )}
      {showModal === 'overlap' && (
        <ConflictModal onGoBack={() => setShowModal(null)} />
      )}
    </>
  );
}
