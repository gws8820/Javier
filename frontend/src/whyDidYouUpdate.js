// whyDidYouUpdate.js
import { useRef, useEffect } from 'react';

function useWhyDidYouUpdate(name, props) {
  const previousProps = useRef({});

  useEffect(() => {
    const allKeys = Object.keys({ ...previousProps.current, ...props });
    const changes = {};
    allKeys.forEach((key) => {
      if (previousProps.current[key] !== props[key]) {
        changes[key] = { before: previousProps.current[key], after: props[key] };
      }
    });
    if (Object.keys(changes).length) {
      console.log('[why-did-you-update]', name, changes);
    }
    previousProps.current = props;
  });

  return null;
}

export default useWhyDidYouUpdate;