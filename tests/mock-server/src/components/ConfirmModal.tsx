import { useNavigate } from 'react-router-dom';
import { getScenario } from '../scenario';

interface Props {
  onClose: () => void;
}

export default function ConfirmModal({ onClose }: Props) {
  const navigate = useNavigate();
  const scenario = getScenario();

  function handleConfirm() {
    navigate('/post-purchase');
  }

  return (
    <div className="ui page modals dimmer transition visible active" style={{ display: 'flex' }}>
      <div className="ui modal transition visible active ui modal small PurchaseConfirm basic ModalWithClose">
        <div role="dialog" aria-modal="true" aria-labelledby="purchaseConfirm-title">
          <div className="ModalWithClose--listFrame ui segment" role="dialog" aria-modal="true" aria-labelledby="purchaseConfirm-title">
            <button className="PlainButton--noStyle ModalWithClose--iconWrapper" type="button" aria-label="Close dialog" onClick={onClose}>
              <img alt="Close dialog" aria-hidden="true" className="ModalWithClose--closeIcon PurchaseConfirm" />
            </button>
            <div className="PurchaseConfirm--content">
              <h1 id="purchaseConfirm-title" className="PurchaseConfirm--header">Does this look right?</h1>
              <div className="Plate">
                <div className="Plate--decoration"><span></span><span></span></div>
                <div className="Plate--number">
                  <h4>Plate #</h4>
                  <h1>{scenario.plate}</h1>
                </div>
                <div className="Plate--decoration"><span></span><span></span></div>
              </div>
              <div className="PurchaseConfirm--detailsRow">Stevens Pass (Zone STEVENSPASS)</div>
              <div className="PurchaseConfirm--detailsRow">Park until Feb 14/26 at 10:05 AM</div>
            </div>
            <button className="oGMkMQAoYbD7f3oxRBJI ButtonComponent" type="button" onClick={handleConfirm}>Confirm</button>
          </div>
        </div>
      </div>
    </div>
  );
}
