export default function ErrorPage() {
  return (
    <div className="TransactionProcessing">
      <div className="TransactionProcessing--wrapper">
        <div className="TransactionProcessing--errorBox">
          <div className="TransactionProcessing--content">
            <img src="" alt="" />
            <div className="TransactionProcessing--errorCopy">
              You've reached the reservation limit for this account and/or plate number.
            </div>
          </div>
        </div>
      </div>
      <div className="TransactionProcessing--checkoutLink">Back to Checkout</div>
    </div>
  );
}
