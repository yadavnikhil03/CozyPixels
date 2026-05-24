import SocialCard from '@/components/forgeui/social-card';
import { FaGithub, FaXTwitter } from 'react-icons/fa6';
import { GiStrikingDiamonds } from 'react-icons/gi';

export function SocialCardExample() {
  return (
    <SocialCard
      image="https://avatars.githubusercontent.com/u/146875269?v=4"
      title="Nikhil"
      name="yadavnikhil03"
      pitch="Open-source projects and pixel art · Connect on GitHub and X"
      icon={<GiStrikingDiamonds />}
      buttons={[
        {
          label: 'Twitter',
          icon: <FaXTwitter />,
          link: 'https://twitter.com/yadavnikhil03',
        },
        {
          label: 'Github',
          icon: <FaGithub />,
          link: 'https://github.com/yadavnikhil03',
        },
      ]}
    />
  );
}
