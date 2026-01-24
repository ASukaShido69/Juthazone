import { format as formatDate, parseISO } from 'date-fns';

// Format currency to Thai Baht
export const formatCurrency = (amount) => {
  return `฿${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

// Format date to Thai format
export const formatDateToThai = (dateString) => {
  const date = parseISO(dateString);
  return formatDate(date, 'dd MMMM yyyy', { locale: 'th' });
};

// Format time to HH:mm
export const formatTime = (dateString) => {
  const date = parseISO(dateString);
  return formatDate(date, 'HH:mm');
};