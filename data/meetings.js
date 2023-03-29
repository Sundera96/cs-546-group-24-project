/*
Meeting Collection {
    _id: ObjectId,
    title: String,
    dateCreated: DateTimeStamp,
    dateAddedTo: DateTimeStamp,
    dateDueOn: DateTimeStamp,
    priority: Number,
    textBody: String,
    tag: String,
    repeating: Boolean,
    repeatingCounterIncrement:Number,
    repeatingIncrementBy : "Day" "Month" "Year"
    repeatingGroup: ObjectId
    expired:Boolean
    }
*/
import utils from "../utils/utils.js";
import { ObjectId } from "mongodb";
import { meetingsCollection } from "../config/mongoCollections.js";
import { usersCollection } from "../config/mongoCollections.js";

const meetingsDataFunctions = {
  //meetingId only needed
  async get(meetingId) {
    // check if meetingId is a string and then check if its a valid Object Id with a new function called checkObjectIdString(stringObjectId)
    utils.checkObjectIdString(meetingId);

    const meetings = await meetingsCollection();
    const meeting = await meetings.findOne({ _id: new ObjectId(meetingId) });

    // if the meeting exists in collection then return it else throw an error
    if (meeting) {
      return meeting;
    } else {
      throw new Error("Meeting not found");
    }
  },
  async update(
    meetingId,
    title,
    dateAddedTo,
    dateDueOn,
    priority,
    textBody,
    tag
  ) {
    // check if meetingId is a string and then check if its a valid Object Id with a new function called checkObjectIdString(stringObjectId)
    utils.checkObjectIdString(meetingId);
    //validate other fields
    if (
      !utils.validateMeetingUpdateInputs(
        title,
        dateAddedTo,
        dateDueOn,
        priority,
        textBody,
        tag
      )
    ) {
      throw new Error("Invalid update inputs for meeting");
    }
    const meetings = await meetingsCollection();
    const updatedMeeting = {};

    // only update the fields that have been provided as input
    updatedMeeting.title = title.trim();
    updatedMeeting.dateAddedTo = dateAddedTo;
    updatedMeeting.dateDueOn = dateDueOn;
    updatedMeeting.priority = priority;
    updatedMeeting.textBody = textBody.trim();
    updatedMeeting.tag = tag.trim();

    const result = await meetings.updateOne(
      { _id: new ObjectId(meetingId) },
      { $set: updatedMeeting }
    );

    // if the meeting was successfully updated, return the updated meeting
    if (
      result.modifiedCount === 1 &&
      result.matchedCount == 1 &&
      result.acknowledged === true
    ) {
      const updatedMeeting = await meetings.findOne({
        _id: new ObjectId(meetingId),
      });
      return updatedMeeting;
    } else {
      if (result.matchedCount !== 1) throw new Error("Meeting not found");
      if (result.modifiedCount !== 1)
        throw new Error("Meeting Details havent Changed");
      if (result.acknowledged !== true)
        throw new Error("Meeting update wasnt successfull");
    }
  },
  async delete(meetingId) {
    utils.checkObjectIdString(meetingId);

    const meetings = await meetingsCollection();
    const deletionInfo = await meetings.findOneAndDelete({
      _id: new ObjectId(meetingId),
    });
    if (deletionInfo.lastErrorObject.n === 0) {
      throw new Error(`${meetingId} not found for deletion`);
    }
    const users = await usersCollection();

    //update the userCollection by removing the same id from the meetingIds array in user collection
    await users.updateOne(
      { meetingIds: new ObjectId(meetingId) },
      { $pull: { meetingIds: new ObjectId(meetingId) } }
    );

    // if the meeting exists in collection then return it else throw an error
    return `${deletionInfo.value.id} has been successfully deleted!`;
  },

  // only userId needed

  /**
   * @param {string} userId userId of which the meeting is being created for
   * @param {string} title title of the meeting
   * @param {Date} dateAddedTo which date this meeting belongs t
   * @param {Date} dateDueOn when does this meeting end passed or calculated
   * param {number} duration duration of the meeting either passed or calculated
   * @param {number} priority priority of the meeting 1 2 or 3
   * @param {string} textBody description of meeting
   * @param {string} tag custom tag
   * @param {boolean} repeating whether it repeats
   * @param {number} repeatingCounterIncrement how many times the meeting repeats.. calculated using a start and end date of repetations from the UI .. it casues the function to repeatedly create the meeting for those many consecutive day monht or year
   * @param {string} repeatingIncrementBy mode of repeating "day" "month" or "year"
   */
  async create(
    userId,
    title,
    dateAddedTo,
    dateDueOn,
    priority,
    textBody,
    tag,
    repeating,
    repeatingCounterIncrement,
    repeatingIncrementBy
  ) {
    utils.checkObjectIdString(userId);
    const isValid = utils.validateMeetingCreateInputs(
      title,
      dateAddedTo,
      dateDueOn,
      priority,
      textBody,
      tag,
      repeating,
      repeatingCounterIncrement,
      repeatingIncrementBy
    );
    if (!isValid) {
      throw new Error("Invalid meeting inputs.");
    }
    title = title.trim();
    dateAddedTo = dateAddedTo.trim();
    let dateAddedToObject = new Date(dateAddedTo);
    dateDueOn = dateDueOn.trim();
    let dateDueOnObject = new Date(dateDueOn);

    textBody = textBody.trim();
    tag = tag.trim();
    repeatingIncrementBy = repeatingIncrementBy.trim();

    const users = await usersCollection();
    const user = await users.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      throw new Error("User not found.");
    }
    let dateCreated = new Date().toString();
    const meetings = await meetingsCollection();
    if (!repeating) {
      const result = await meetings.insertOne({
        title,
        dateCreated,
        dateAddedTo,
        dateDueOn,
        priority,
        textBody,
        tag,
        repeating,
        repeatingCounterIncrement,
        repeatingIncrementBy,
        repeatingGroup: null,
        expired: false,
        type: "meeting",
      });
      const insertedId = result.insertedId;
      await users.updateOne(
        { _id: new ObjectId(userId) },
        { $push: { meetingIds: insertedId } }
      );
      return this.get(insertedId.toString());
    } else {
      const repeatingGroup = new ObjectId();
      const meetingObjects = [];

      for (let i = 0; i < repeatingCounterIncrement; i++) {
        let newDateDueOn;
        let newDateAddedTo;
        switch (repeatingIncrementBy) {
          case "day":
            newDateDueOn = new Date(
              dateDueOnObject.setDate(dateDueOnObject.getDate() + 1)
            );
            newDateAddedTo = new Date(
              dateAddedToObject.setDate(dateAddedToObject.getDate() + 1)
            );
            break;
          case "week":
            newDateDueOn = new Date(
              dateDueOnObject.setDate(dateDueOnObject.getDate() + 7)
            );
            newDateAddedTo = new Date(
              dateAddedToObject.setDate(dateAddedToObject.getDate() + 7)
            );
            break;
          case "month":
            newDateDueOn = new Date(
              dateDueOnObject.setMonth(dateDueOnObject.getMonth() + 1)
            );
            newDateAddedTo = new Date(
              dateAddedToObject.setMonth(dateAddedToObject.getMonth() + 1)
            );
            break;
          case "year":
            newDateDueOn = new Date(
              dateDueOnObject.setFullYear(dateDueOnObject.getFullYear() + 1)
            );
            newDateAddedTo = new Date(
              dateAddedToObject.setFullYear(dateAddedToObject.getFullYear() + 1)
            );
            break;
          default:
            throw new Error("Invalid repeatingIncrementBy value");
        }

        const meeting = {
          title,
          dateCreated,
          dateAddedTo: newDateAddedTo.toString(),
          dateDueOn: newDateDueOn.toString(),
          priority,
          textBody,
          tag,
          repeating,
          repeatingCounterIncrement,
          repeatingIncrementBy,
          repeatingGroup,
          expired: false,
          type: "meeting",
        };
        meetingObjects.push(meeting);
        dateDueOn = newDateDueOn;
        dateAddedTo = newDateAddedTo;
      }

      const result = await meetings.insertMany(meetingObjects);
      const insertedIds = Object.values(result.insertedIds);
      await users.updateOne(
        { _id: new ObjectId(userId) },
        { $push: { meetingIds: { $each: insertedIds } } }
      );
      return this.getAll(userId);
    }
  },

  async getAll(userId) {
    utils.checkObjectIdString(userId);

    const users = await usersCollection();
    const user = await users.findOne({ _id: new ObjectId(userId) });
    if (user) {
      const meetingIdList = user.meetingIds;
      const meetings = await meetingsCollection();
      const meetingsList = await meetings
        .find({ _id: { $in: meetingIdList } })
        .toArray();
      return meetingsList;
    } else {
      throw new Error("user not found");
    }
  },

  // userId and repeatingGroup needed
  async getAllRecurrences(userId, repeatingGroup) {
    utils.checkObjectIdString(userId);
    utils.checkObjectIdString(repeatingGroup);

    const users = await usersCollection();
    const user = await users.findOne({ _id: new ObjectId(userId) });
    if (user) {
      const meetingIdList = user.meetingIds;
      const meetings = await meetingsCollection();
      const recurringMeetingsList = await meetings
        .find({
          _id: { $in: meetingIdList },
          repeatingGroup: new ObjectId(repeatingGroup),
        })
        .toArray();
      return recurringMeetingsList;
    } else {
      throw new Error("repeatingGroup of meetings not found");
    }
  },
  async updateAllRecurrences(
    userId,
    title,
    dateAddedTo,
    dateDueOn,
    priority,
    textBody,
    tag,
    repeatingGroup
  ) {
    utils.checkObjectIdString(userId.trim());
    utils.checkObjectIdString(repeatingGroup.trim());

    const isValid = utils.validateMeetingUpdateAllRecurrencesInputs(
      title,
      dateAddedTo,
      dateDueOn,
      priority,
      textBody,
      tag
    );
    if (!isValid) {
      throw new Error("Invalid meeting inputs.");
    }

    userId = userId.trim();
    title = title.trim();
    dateAddedTo = dateAddedTo.trim();
    dateDueOn = dateDueOn.trim();
    textBody = textBody.trim();
    tag = tag.trim();
    repeatingGroup = repeatingGroup.trim();

    const users = await usersCollection();
    const user = await users.findOne({ _id: new ObjectId(userId) });
    const meetingIdList = user.meetingIds;
    const meetings = await meetingsCollection();
    const result = await meetings.updateMany(
      {
        _id: { $in: meetingIdList },
        repeatingGroup: new ObjectId(repeatingGroup),
      },
      {
        $set: {
          title: title,
          dateAddedTo: dateAddedTo,
          dateDueOn: dateDueOn,
          priority: priority,
          textBody: textBody,
          tag: tag,
        },
      }
    );
    if (
      result.modifiedCount > 0 &&
      result.matchedCount > 0 &&
      result.acknowledged === true
    ) {
      const updatedMeetings = await this.getAllRecurrences(
        userId,
        repeatingGroup
      );
      return updatedMeetings;
    } else {
      if (result.matchedCount == 0) throw new Error("Meetings not found");
      if (result.modifiedCount == 0)
        throw new Error("Meetings Details havent Changed");
      if (result.acknowledged !== true)
        throw new Error("Meetings update wasnt successfull");
    }
  },
  async deleteAllRecurrences(userId, repeatingGroup) {
    utils.checkObjectIdString(userId.trim());
    utils.checkObjectIdString(repeatingGroup.trim());

    userId = userId.trim();
    repeatingGroup = repeatingGroup.trim();

    const users = await usersCollection();
    const user = await users.findOne({ _id: new ObjectId(userId) });
    const meetingIdList = user.meetingIds;
    const meetings = await meetingsCollection();

    const result = await meetings.deleteMany({
      _id: { $in: meetingIdList },
      repeatingGroup: new ObjectId(repeatingGroup),
    });

    if (result.deletedCount > 0 && result.acknowledged === true) {
      return result;
    } else {
      if (result.deletedCount == 0) throw new Error("Meetings not found");
      if (result.acknowledged !== true)
        throw new Error("Meetings delete was not successful");
    }
  },
};
export default meetingsDataFunctions;
