import { sampleReceipt } from '../../stories/receiptSample';
import { ReceiptPaper } from './ReceiptPaper';

const receipt = sampleReceipt(0.7);

export const Paper = () => (
  <div className="max-w-xl rounded-hero bg-shelf p-6">
    <ReceiptPaper lines={receipt.lines} locationOf={() => 'fridge'} initialCount={6} />
  </div>
);
