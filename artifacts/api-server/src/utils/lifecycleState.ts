let shuttingDown = false;

export const isShuttingDown = (): boolean => shuttingDown;

export const setShuttingDown = (value: boolean): void => {
  shuttingDown = value;
};

export const resetShutdownState = (): void => {
  shuttingDown = false;
};
