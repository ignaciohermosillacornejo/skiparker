interface Props {
  onGoBack: () => void;
}

export default function ConflictModal({ onGoBack }: Props) {
  return (
    <div className="ui page modals dimmer transition visible active" style={{ display: 'flex' }}>
      <div className="ui modal transition visible active ui modal small ConflictConfirm">
        <div role="dialog" aria-modal="true" aria-labelledby="conflictConfirmModal-title">
          <div className="ConflictConfirm--content">
            <span id="conflictConfirmModal-title" aria-hidden="true" className="ConflictConfirm--content sr-only">
              Parking Session Overlap Detected
            </span>
            <h1 className="ConflictConfirm--header">
              This session overlaps the following previously-purchased session:
            </h1>
            <div className="ConflictConfirm-parkingSessionsList">
              <div>
                <div className="CommonParkingSessionDetails--panel ui segment">
                  <div className="CommonParkingSessionDetails--container">
                    <div className="CommonParkingSessionDetails--main">
                      <div className="CommonParkingSessionDetails--location">
                        <div className="CommonParkingSessionDetails--zoneId">Zone STEVENSPASS</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="ConflictConfirm--buttons">
              <button className="PlainButton--noStyle ui button fluid ConflictConfirm--button" type="button" aria-label="Exit parking conflict confirmation" onClick={onGoBack}>
                Go Back
              </button>
              <button className="PlainButton--noStyle ui button fluid ConflictConfirm--button ConflictConfirm--continue" type="button" aria-label="Continue with purchase">
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
