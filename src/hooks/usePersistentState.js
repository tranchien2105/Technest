import { useEffect, useState } from "react";
import { readStored, writeStored } from "../domain/storage";

export function usePersistentState(key, fallback) {
  const [value, setValue] = useState(() => readStored(key, fallback));
  useEffect(() => {
    writeStored(key, value);
  }, [key, value]);
  return [value, setValue];
}
