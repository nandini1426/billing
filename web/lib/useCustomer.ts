import { useState } from 'react';
import api from './api';

export interface Customer {
  customer_name: string;
  customer_phone: string;
  order_count: number;
  last_order: string;
}

export function useCustomer() {
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);

  const searchCustomers = async (query: string) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get(`/orders/customers/search?q=${query}`);
      setSuggestions(res.data);
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  };

  const clearSuggestions = () => setSuggestions([]);

  return { suggestions, searching, searchCustomers, clearSuggestions };
}