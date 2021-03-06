import { Injectable } from '@nestjs/common';
import { ContestResult } from 'api/admin/submit/results/dto/submit-contest-result.dto';
import { groupBy } from 'lodash';
import { Constants } from 'shared/constants';
import { ContestType } from 'shared/enums';
import { Utils } from 'shared/utils';

export interface DetailedContestResult extends ContestResult {
  readonly category: ContestType;
}

export interface AthletePointsDictionary {
  [key: string]: { points: number; place: number };
}

interface IAthletePoint {
  athlete: { athleteId: string; place: number };
  points: number;
  isPointsStaticallyGiven: boolean;
}

@Injectable()
export class ContestPointsCalculatorService {
  constructor() {}

  public calculatePoints(results: DetailedContestResult): AthletePointsDictionary {
    const numOfParticipants = results.places.length;
    const sortedPlaces = results.places.sort((a, b) => a.place - b.place);
    let calculatedAthletePoints = sortedPlaces.map<IAthletePoint>((athlete, index) => {
      const defaultPlace = index + 1;
      let points = athlete.points;
      let isPointsStaticallyGiven = false;
      if (Utils.isNil(points)) {
        points = this.calculatePoint(results.category, defaultPlace, numOfParticipants);
        isPointsStaticallyGiven = true;
      }
      return {
        athlete: athlete,
        points: points,
        isPointsStaticallyGiven: isPointsStaticallyGiven,
      };
    });

    calculatedAthletePoints = this.calculatePointsForTie(calculatedAthletePoints);

    const athletePoints: AthletePointsDictionary = {};
    calculatedAthletePoints.forEach(p => {
      athletePoints[p.athlete.athleteId] = { points: p.points, place: p.athlete.place };
    });
    return athletePoints;
  }

  private calculatePoint(contestType: ContestType, place: number, numberOfParticipants: number) {
    // For details check ISA's score calculation algoritm

    const minParticipantThreshold = Constants.ContestTypeMinParticipantsLimit(contestType);
    if (numberOfParticipants < minParticipantThreshold) {
      return 0;
    }
    const maxRange = Constants.ContestScoringRange(contestType);
    if (place > maxRange) {
      return 1;
    }
    const pointOfFirstPlace = Constants.ContestTypeTopPoints(contestType);
    const A = (1 - pointOfFirstPlace) / Math.log(Math.min(numberOfParticipants, maxRange));
    const B = pointOfFirstPlace;

    const point = A * Math.log(place) + B;
    return Math.round(point);
  }

  private calculatePointsForTie(calculatedAthletePoints: IAthletePoint[]) {
    const pointsGroup = groupBy(calculatedAthletePoints, a => a.athlete.place);
    const modifiedAthletePointArray: IAthletePoint[] = [];

    for (const place in pointsGroup) {
      if (pointsGroup.hasOwnProperty(place)) {
        const athletePointArray = pointsGroup[place];
        if (athletePointArray.length > 1) {
          const average = athletePointArray.map(a => a.points).reduce((a, b) => a + b, 0) / athletePointArray.length;
          athletePointArray.forEach(a => {
            if (a.isPointsStaticallyGiven) {
              modifiedAthletePointArray.push({ ...a }); // dont change the points
            } else {
              modifiedAthletePointArray.push({ ...a, points: Math.round(average) });
            }
          });
        } else {
          modifiedAthletePointArray.push(...athletePointArray);
        }
      }
    }
    return modifiedAthletePointArray;
  }
}
