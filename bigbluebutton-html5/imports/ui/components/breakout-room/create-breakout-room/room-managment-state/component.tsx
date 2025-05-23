import React, { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useQuery } from '@apollo/client';
import {
  BreakoutUser,
  Rooms,
  ChildComponentProps,
  Room,
  moveUserRegistery,
  Presentation,
  RoomPresentations,
} from './types';
import {
  breakoutRoom, getBreakoutsResponse, getLastBreakouts, getMeetingGroupResponse, LastBreakoutData,
} from '../queries';

const intlMessages = defineMessages({
  breakoutRoom: {
    id: 'app.createBreakoutRoom.room',
    description: 'breakout room',
  },
  notAssigned: {
    id: 'app.createBreakoutRoom.notAssigned',
    description: 'Not assigned label',
  },
});

interface RoomManagmentStateProps {
  numberOfRooms: number;
  users: BreakoutUser[];
  RendererComponent: React.FC<ChildComponentProps>;
  runningRooms: getBreakoutsResponse['breakoutRoom'] | null;
  setFormIsValid: (isValid: boolean) => void;
  setRoomsRef: (rooms: Rooms) => void;
  setMoveRegisterRef: (moveRegister: moveUserRegistery) => void;
  presentations: Presentation[];
  roomPresentations: RoomPresentations;
  setRoomPresentations: React.Dispatch<React.SetStateAction<RoomPresentations>>;
  currentPresentation: string;
  currentSlidePrefix: string;
  getRoomPresentation: (roomId: number) => string;
  isUpdate: boolean;
  setNumberOfRooms: React.Dispatch<React.SetStateAction<number>>;
  groups: getMeetingGroupResponse['meeting_group'];
}

const RoomManagmentState: React.FC<RoomManagmentStateProps> = ({
  numberOfRooms,
  users,
  RendererComponent,
  setFormIsValid,
  runningRooms,
  setRoomsRef,
  setMoveRegisterRef,
  presentations,
  roomPresentations,
  setRoomPresentations,
  currentPresentation,
  currentSlidePrefix,
  getRoomPresentation,
  isUpdate,
  setNumberOfRooms,
  groups,
}) => {
  const intl = useIntl();
  const [selectedId, setSelectedId] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<number>(0);
  const [rooms, setRooms] = useState<Rooms>({});
  const [init, setInit] = useState<boolean>(false);
  const [roomsRestored, setRoomsRestored] = useState<boolean>(false);
  const [movementRegistered, setMovementRegistered] = useState<moveUserRegistery>({});

  // accepts one or multiple users
  const moveUser = (userId: string | string[], from: number | number[], to: number | number[]) => {
    const userIds = Array.isArray(userId) ? userId : [userId];
    const fromRooms = Array.isArray(from) ? from : [from];
    const toRooms = Array.isArray(to) ? to : [to];

    let updatedMovementRegistered = { ...movementRegistered };
    const updatedRooms = { ...rooms };

    userIds.forEach((id, index) => {
      const fromRoom = fromRooms[index] || fromRooms[0];
      const toRoom = toRooms[index] || toRooms[0];

      const room = updatedRooms[toRoom];
      const roomFrom = updatedRooms[Number(fromRoom)];

      if (fromRoom === toRoom) return null;

      updatedMovementRegistered = {
        ...updatedMovementRegistered,
        [id]: {
          fromSequence: fromRoom,
          toSequence: toRoom,
          toRoomId: runningRooms?.find((r) => r.sequence === toRoom)?.breakoutRoomId,
          fromRoomId: runningRooms?.find((r) => r.sequence === fromRoom)?.breakoutRoomId,
        },
      };

      if (!updatedRooms[toRoom]) {
        updatedRooms[fromRoom].users = (updatedRooms[fromRoom].users.filter((user) => user.userId !== id) || []);
        updatedRooms[toRoom] = {
          id: toRoom,
          name: intl.formatMessage(intlMessages.breakoutRoom, {
            0: toRoom,
          }),
          users: [users.find((user) => user.userId === id)].filter((user) => user),
        } as Room;
      } else {
        updatedRooms[toRoom] = {
          ...room,
          users: [
            ...(room?.users ?? []),
            roomFrom?.users?.find((user) => user.userId === id),
          ].filter((user) => user),
        } as Room;
        updatedRooms[fromRoom] = {
          ...roomFrom,
          users: roomFrom?.users.filter((user) => user.userId !== id),
        } as Room;
      }
      return null;
    });

    setMovementRegistered(updatedMovementRegistered);
    setRooms(updatedRooms);
  };

  const roomName = (room: number) => {
    const defaultName = intl.formatMessage(intlMessages.breakoutRoom, {
      0: room,
    });
    if (rooms[room]) {
      return rooms[room].name || defaultName;
    }
    return defaultName;
  };

  const changeRoomName = (room: number, name: string) => {
    setRooms((prevRooms) => {
      const rooms = { ...prevRooms };
      if (!rooms[room]) {
        rooms[room] = {
          id: room,
          name: '',
          users: [],
        };
      }
      rooms[room].name = name;
      return rooms;
    });
  };

  const randomlyAssign = () => {
    // assign users to rooms in an evenly distributed manner
    const withoutModerators = rooms[0].users.filter((user) => !user.isModerator);
    const userIds = withoutModerators.sort(() => Math.random() - 0.5).map((user) => user.userId);
    const numberOfUsers = withoutModerators.length;
    const assignments = new Array(numberOfUsers);

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < numberOfUsers; i++) {
      assignments[i] = (i % numberOfRooms) + 1;
    }

    moveUser(userIds, 0, assignments);
  };

  const resetRooms = (cap: number) => {
    const greterThanRooms = Object.keys(rooms).filter((room) => Number(room) > cap);
    greterThanRooms.forEach((room) => {
      if (rooms && rooms[Number(room)]) {
        setRooms((prevRooms) => ({
          ...prevRooms,
          0: {
            ...prevRooms[0],
            users: [
              ...prevRooms[0].users,
              ...rooms[Number(room)].users,
            ].filter((user) => user),
          },
          [Number(room)]: {
            ...prevRooms[Number(room)],
            users: [],
          },
        }));
      }
    });
  };

  const {
    data: lastBreakoutData,
  } = useQuery<LastBreakoutData>(getLastBreakouts, {
    fetchPolicy: 'network-only',
  });

  useEffect(() => {
    if (runningRooms?.length && runningRooms.length > 0) return;
    const lastBreakouts = lastBreakoutData?.breakoutRoom_createdLatest ?? [];
    if (lastBreakouts.length > 0 && init) {
      const roomState: Rooms = {};
      lastBreakouts.forEach((room) => {
        roomState[room.sequence] = {
          id: room.sequence,
          name: room.isDefaultName
            ? intl.formatMessage(intlMessages.breakoutRoom, { 0: room.sequence })
            : room.shortName,
          users: [],
        };
      });
      setNumberOfRooms(Object.keys(roomState).length);
      setRooms((prevRooms: Rooms) => ({
        ...(prevRooms ?? {}),
        ...roomState,
      }));
      setRoomsRestored(true);
    }
  }, [lastBreakoutData, init]);

  useEffect(() => {
    if (lastBreakoutData?.user && roomsRestored) {
      const usersToMove: string[] = [];
      const toRooms: number[] = [];

      if (runningRooms?.length && runningRooms.length > 0) return;

      lastBreakoutData.user.forEach((user) => {
        if (user.lastBreakoutRoom?.sequence) {
          const roomSequence = Number(user.lastBreakoutRoom.sequence);

          usersToMove.push(user.lastBreakoutRoom.userId);
          toRooms.push(roomSequence);
        }
      });

      if (usersToMove.length > 0) {
        moveUser(usersToMove, 0, toRooms);
      }
    }
  }, [lastBreakoutData, roomsRestored]);

  useEffect(() => {
    if (users && users.length > 0) {
      // set users to room 0
      setInit(true);
      setRooms((prevRooms: Rooms) => ({
        ...(prevRooms ?? {}),
        0: {
          id: 0,
          name: intl.formatMessage(intlMessages.notAssigned, { 0: 0 }),
          users,
        },
      }));
    }
  }, [users]);

  useEffect(() => {
    if (groups.length && init && lastBreakoutData && !(lastBreakoutData.breakoutRoom_createdLatest.length > 0)) {
      setNumberOfRooms(groups.length >= 2 ? groups.length : 2);

      // set the rooms based on the groups
      setRooms((prevRooms: Rooms) => {
        const rooms = { ...prevRooms };
        Array.from(groups).forEach((group, index) => {
          const idx = index + 1;
          const roomUsers = group.usersExtId
            .map((id) => users.find((user) => user.extId === id))
            .filter((user) => user) as BreakoutUser[];
          rooms[idx] = {
            id: idx,
            name: group.name || roomName(idx),
            users: roomUsers,
          };

          rooms[0].users = rooms[0].users.filter((user) => !roomUsers.find((u) => u.userId === user.userId));
        });

        return rooms;
      });
    }
  }, [init, lastBreakoutData]);

  useEffect(() => {
    if (runningRooms && init) {
      const usersToMove: string[] = [];
      const toRooms: number[] = [];

      runningRooms.forEach((r: breakoutRoom) => {
        r.participants.forEach((u) => {
          if (!rooms[r.sequence]?.users?.find((user) => user.userId === u.user.userId)) {
            usersToMove.push(u.user.userId);
            toRooms.push(r.sequence);
          }
        });
      });

      if (usersToMove.length > 0) {
        moveUser(usersToMove, 0, toRooms);
      }
    }
  }, [runningRooms, init]);

  useEffect(() => {
    if (rooms) {
      setRoomsRef(rooms);
      if (!(rooms[0]?.users?.length === users.length)) {
        setFormIsValid(true);
      } else {
        setFormIsValid(false);
      }
    }
  }, [rooms]);

  useEffect(() => {
    if (movementRegistered) {
      setMoveRegisterRef(movementRegistered);
    }
  }, [movementRegistered]);

  return (
    <>
      {
        init ? (
          <RendererComponent
            moveUser={moveUser}
            rooms={rooms}
            getRoomName={roomName}
            changeRoomName={changeRoomName}
            numberOfRooms={numberOfRooms}
            selectedId={selectedId ?? ''}
            setSelectedId={setSelectedId}
            selectedRoom={selectedRoom}
            setSelectedRoom={setSelectedRoom}
            randomlyAssign={randomlyAssign}
            resetRooms={resetRooms}
            users={users}
            currentSlidePrefix={currentSlidePrefix}
            presentations={presentations}
            roomPresentations={roomPresentations}
            setRoomPresentations={setRoomPresentations}
            getRoomPresentation={getRoomPresentation}
            currentPresentation={currentPresentation}
            isUpdate={isUpdate}
          />
        ) : null
      }
    </>
  );
};

export default RoomManagmentState;
