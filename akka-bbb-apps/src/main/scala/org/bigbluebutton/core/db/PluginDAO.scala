package org.bigbluebutton.core.db

import PostgresProfile.api._

case class PluginDbModel(
    meetingId:                     String,
    name:                          String,
    javascriptEntrypointUrl:       String,
    javascriptEntrypointIntegrity: String,
    localesBaseUrl:                String
)

class PluginDbTableDef(tag: Tag) extends Table[PluginDbModel](tag, None, "plugin") {
  val meetingId = column[String]("meetingId", O.PrimaryKey)
  val name = column[String]("name", O.PrimaryKey)
  val javascriptEntrypointUrl = column[String]("javascriptEntrypointUrl")
  val javascriptEntrypointIntegrity = column[String]("javascriptEntrypointIntegrity")
  val localesBaseUrl = column[String]("localesBaseUrl")
  override def * = (meetingId, name, javascriptEntrypointUrl,
    javascriptEntrypointIntegrity, localesBaseUrl) <> (PluginDbModel.tupled, PluginDbModel.unapply)
}

object PluginDAO {
  def insert(meetingId: String, name: String, javascriptEntrypointUrl: String,
             javascriptEntrypointIntegrity: String, localesBaseUrl: Option[String]) = {
    val localesBaseUrlValue = localesBaseUrl.getOrElse("")
    DatabaseConnection.enqueue(
      TableQuery[PluginDbTableDef].forceInsert(
        PluginDbModel(
          meetingId = meetingId,
          name = name,
          javascriptEntrypointUrl = javascriptEntrypointUrl,
          javascriptEntrypointIntegrity = javascriptEntrypointIntegrity,
          localesBaseUrl = localesBaseUrlValue

        )
      )
    )
  }
}