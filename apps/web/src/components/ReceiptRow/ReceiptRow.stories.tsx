import { MemoryRouter } from 'react-router-dom';
import { sampleReceipt } from '../../stories/receiptSample';
import { Button } from '../Button/Button';
import { ReceiptRow } from './ReceiptRow';

const clean = sampleReceipt();
const review = sampleReceipt(0.55);

export const Rows = () => (
  <MemoryRouter>
    <ul className="flex max-w-xl flex-col gap-3">
      <li>
        <ReceiptRow
          receipt={review}
          dateText="Today, 9:02 AM"
          scanner={{ name: 'Maya', initial: 'M', tone: 'sage' }}
          scannerName="Maya"
          href="#"
          action={<Button fullWidth>Review 2 lines</Button>}
        />
      </li>
      <li>
        <ReceiptRow
          receipt={clean}
          dateText="Sep 24"
          scanner={{ name: 'Shruti', initial: 'S', tone: 'periwinkle' }}
          scannerName="You"
          href="#"
          selected
        />
      </li>
      <li>
        <ReceiptRow
          receipt={{ ...clean, reviewState: 'edited', storeName: 'Whole Foods' }}
          dateText="Sep 14"
          scanner={null}
          scannerName="Arjun"
          href="#"
        />
      </li>
    </ul>
  </MemoryRouter>
);
