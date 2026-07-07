import { useSelector } from 'react-redux';
import { getTranslation } from '../localization/translations';

export const useTranslation = () => {
  const language = useSelector((state) => state.settings.language) || 'en';

  const t = (key) => {
    return getTranslation(language, key);
  };

  return { t, language };
};
