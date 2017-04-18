import { delay } from 'redux-saga';
import { call, fork, put, select, takeLatest } from 'redux-saga/effects';

import ShuttleService from '../services/shuttleService';

const getShuttle = (state) => (state.shuttle);

function* addStop(action) {
	const shuttle = yield select(getShuttle);
	const savedStops = shuttle.savedStops.slice(); // copy array
	const stops = Object.assign({}, shuttle.stops);
	const closestStop = Object.assign({}, shuttle.closestStop);
	let contains = false;

	// Make sure stop hasn't already been saved
	for (let i = 0;  i < savedStops.length; ++i) {
		if (savedStops[i].id === action.stopID) {
			contains = true;
			break;
		}
	}
	if (!contains) {
		savedStops.unshift(stops[action.stopID]);
	}

	// Updated closestStop index
	++closestStop.savedIndex;

	yield put({ type: 'CHANGED_STOPS', savedStops });
	yield put({ type: 'SET_CLOSEST_STOP', closestStop });
	yield call(resetScroll);
	yield fork(fetchArrival, action.stopID);
}

function* removeStop(action) {
	const shuttle = yield select(getShuttle);
	const savedStops = shuttle.savedStops.slice();
	const closestStop = Object.assign({}, shuttle.closestStop);

	let i;
	// Remove stop from saved array
	for (i = 0; i < savedStops.length; ++i) {
		if (savedStops[i].id === action.stopID) {
			savedStops.splice(i, 1);
			break;
		}
	}

	// Update closestStop index
	if (i < closestStop.savedIndex) {
		--closestStop.savedIndex;
	}

	yield put({ type: 'CHANGED_STOPS', savedStops });
	yield put({ type: 'SET_CLOSEST_STOP', closestStop });
	yield call(resetScroll);
}

function* orderStops(action) {
	try {
		const { newOrder } = action;
		if (newOrder && newOrder.length > 0) {
			const { newStops, newClosest } = yield call(doOrder, newOrder);

			yield put({ type: 'CHANGED_STOPS', savedStops: newStops });
			yield put({ type: 'SET_CLOSEST_STOP', closestStop: newClosest });
			yield call(resetScroll);
		}
	} catch (error) {
		console.log('Error re-ordering stops: ' + error);
	}
}

function doOrder(newOrder) {
	const newStops = [];
	let closestStop;

	for (let i = 0; i < newOrder.length; ++i) {
		if (newOrder[i].closest) {
			// Update closest stop index
			newOrder[i].savedIndex = i;
			closestStop = newOrder[i];
		} else {
			newStops.push(newOrder[i]);
		}
	}
	return { newStops, newClosest: closestStop };
}

function* resetScroll() {
	yield put({ type: 'SET_SHUTTLE_SCROLL', lastScroll: 0 });
}

function* setScroll(action) {
	yield put({ type: 'SET_SHUTTLE_SCROLL', lastScroll: action.scrollX });
}

function* fetchArrival(stopID) {
	try {
		const shuttle = yield select(getShuttle);
		const stops = Object.assign({}, shuttle.stops);
		const arrivals = yield call(ShuttleService.FetchShuttleArrivalsByStop, stopID);

		// Sort arrivals, should be on lambda?
		arrivals.sort((a, b) => {
			const aSecs = a.secondsToArrival;
			const bSecs = b.secondsToArrival;

			if ( aSecs < bSecs ) return -1;
			if ( aSecs > bSecs) return 1;
			return 0;
		});

		stops[stopID].arrivals = arrivals;

		yield put({ type: 'SET_ARRIVALS', stops });
	} catch (error) {
		console.log('Error fetching arrival for ' + stopID + ': ' + error);
	}
}

// Manual fetch arrivals
function* fetchArrivalMan(action) {
	yield call(fetchArrival, action.stopID);
}

function* watchArrivals() {
	while (true) {
		const { closestStop } = yield select(getShuttle);
		// Fetch arrivals for all saved stops
		/*for (let i = 0; i < savedStops.length; ++i) {
			const stopID = savedStops[i].id;
			yield call(fetchArrival, stopID);
		}*/
		if (closestStop) {
			yield call(fetchArrival, closestStop.id); // Fetch arrival for closest stop
		}
		yield delay(60000); // wait 60s before pinging again
	}
}

function* shuttleSaga() {
	/*yield takeLatest('ADD_STOP', addStop);
	yield takeLatest('REMOVE_STOP', removeStop);
	yield takeLatest('ORDER_STOPS', orderStops);
	yield takeLatest('FETCH_ARRIVAL', fetchArrivalMan);
	yield takeLatest('UPDATE_SHUTTLE_SCROLL', setScroll);*/
	yield call(watchArrivals);
}

export default shuttleSaga;
