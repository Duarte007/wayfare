import type { FileSaver } from '../domain/account-ports';

/** Downloads a file through a temporary link. */
export const browserFileSaver: FileSaver = {
  save(name, file) {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    // Some browsers read the URL after click() returns.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
