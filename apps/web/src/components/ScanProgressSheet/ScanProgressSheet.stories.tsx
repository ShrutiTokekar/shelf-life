import { ScanProgressSheet } from './ScanProgressSheet';

const lock = 'Processed on your phone. Nothing is uploaded.';

export const Reading = () => (
  <div className="max-w-[24.375rem] bg-ink pt-10">
    <ScanProgressSheet
      lockText={lock}
      onCancel={() => undefined}
      progress={{
        percent: 72,
        lineCount: 14,
        preparing: false,
        steps: { clean: 'done', read: 'done', match: 'active', expiry: 'todo' },
      }}
    />
  </div>
);

export const FirstScanDownloading = () => (
  <div className="max-w-xl">
    <ScanProgressSheet
      variant="card"
      lockText={lock}
      onCancel={() => undefined}
      progress={{
        percent: 5,
        lineCount: null,
        preparing: true,
        steps: { clean: 'active', read: 'todo', match: 'todo', expiry: 'todo' },
      }}
    />
  </div>
);
