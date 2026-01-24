import { format } from 'date-fns';

// Function to format time in HH:mm:ss
export const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// Function to get the current time in a specific format
export const getCurrentTime = () => {
  return format(new Date(), 'HH:mm:ss');
};

// Function to calculate the difference between two times in seconds
export const timeDifferenceInSeconds = (startTime, endTime) => {
  return Math.floor((endTime - startTime) / 1000);
};