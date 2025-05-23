package org.bigbluebutton.core.apps.audiogroups

import org.bigbluebutton.common2.msgs._
import org.bigbluebutton.core.bus.MessageBus
import org.bigbluebutton.core.domain.MeetingState2x
import org.bigbluebutton.core.running.LiveMeeting
import org.bigbluebutton.core.models.AudioGroup
import org.bigbluebutton.core.apps.{ PermissionCheck, RightsManagementTrait }

trait AudioGroupAddParticipantsReqMsgHdlr extends RightsManagementTrait {
  this: AudioGroupHdlrs =>

  def handle(msg: AudioGroupAddParticipantsReqMsg, state: MeetingState2x,
             liveMeeting: LiveMeeting, bus: MessageBus): MeetingState2x = {

    def broadcastEvent(ag: AudioGroup): Unit = {
      val routing = Routing.addMsgToClientRouting(
        MessageTypes.BROADCAST_TO_MEETING,
        liveMeeting.props.meetingProp.intId,
        msg.header.userId
      )
      val envelope = BbbCoreEnvelope(AudioGroupParticipantsAddedEvtMsg.NAME, routing)
      val header = BbbClientMsgHeader(AudioGroupParticipantsAddedEvtMsg.NAME, liveMeeting.props.meetingProp.intId, msg.header.userId)
      val body = AudioGroupParticipantsAddedEvtMsgBody(msg.header.userId, ag.id, ag.findAllSenders(), ag.findAllReceivers())
      val event = AudioGroupParticipantsAddedEvtMsg(header, body)
      val respMsg = BbbCommonEnvCoreMsg(envelope, event)
      bus.outGW.send(respMsg)
    }

    val senders = msg.body.senders
    val receivers = msg.body.receivers
    val affectsOtherUsers = senders.exists(_ != msg.header.userId) || receivers.exists(_ != msg.header.userId)

    if (affectsOtherUsers && permissionFailed(
      PermissionCheck.MOD_LEVEL,
      PermissionCheck.VIEWER_LEVEL, liveMeeting.users2x, msg.header.userId
    )) {
      val meetingId = liveMeeting.props.meetingProp.intId
      val reason = "No permission to add participants to an audio group"
      PermissionCheck.ejectUserForFailedPermission(meetingId, msg.header.userId, reason, bus.outGW, liveMeeting)
      return state
    }

    AudioGroupApp.findAudioGroup(msg.body.id, state.audioGroups) match {
      case Some(ag) =>
        val updatedGroups = AudioGroupApp.addAudioGroupParticipants(
          msg.body.id,
          senders,
          receivers,
          state.audioGroups
        )
        broadcastEvent(ag)
        // TODO: No DB for now - will be used later - prlanzarin
        val newState = state.update(updatedGroups)
        AudioGroupApp.handleAudioGroupUpdated(ag.id, updatedGroups, liveMeeting, bus.outGW)
        newState
      case None =>
        state
    }
  }
}
