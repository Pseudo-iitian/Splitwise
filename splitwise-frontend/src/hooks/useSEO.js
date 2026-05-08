import { useEffect } from 'react';

/**
 * Sets the browser tab title and meta description dynamically per page.
 * @param {string} title - Page title (without brand suffix)
 * @param {string} [description] - Optional meta description override
 */
export default function useSEO(title, description) {
  useEffect(() => {
    const brand = 'SplitKaro';
    document.title = title ? `${title} | ${brand}` : `${brand} – Free Expense Splitting App`;

    if (description) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = description;
    }
  }, [title, description]);
}
