import Seo from '@/components/Seo';

interface FestivalSeoProps {
  festival: {
    id: number;
    name: string;
    year: number;
    location: string | null;
  };
  performanceCount: number;
  stageCount: number;
  dayCount: number;
}

function festivalTitle(festival: FestivalSeoProps['festival']) {
  return festival.name.includes(String(festival.year)) ? festival.name : `${festival.name} ${festival.year}`;
}

function festivalDescription({ festival, performanceCount, stageCount, dayCount }: FestivalSeoProps) {
  const location = festival.location ? ` in ${festival.location}` : '';

  if (performanceCount > 0) {
    return `${festivalTitle(festival)} schedule${location}: explore ${performanceCount} performances across ${stageCount} stages and ${dayCount} days, save must-see artists, and plan with your crew on Lineup·Mate.`;
  }

  return `${festivalTitle(festival)} lineup planner${location}: explore the schedule, save must-see artists, and plan your festival with friends on Lineup·Mate.`;
}

export default function FestivalSeo(props: FestivalSeoProps) {
  const { festival } = props;

  return (
    <Seo
      title={`${festivalTitle(festival)} lineup planner | Lineup·Mate`}
      description={festivalDescription(props)}
      canonicalPath={`/festival/${festival.id}`}
    />
  );
}
