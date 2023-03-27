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

const meetingsDataFunctions = {
  //meetingId only needed
  async get(meetingId) {
    // check if meetingId is a string and then check if its a valid Object Id with a new function called checkObjectIdString(stringObjectId)
    if (!utils.checkObjectIdString(meetingId)) {
      throw new Error("Invalid meeting ID");
    }

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
    if (!utils.checkObjectIdString(meetingId)) {
      throw new Error("Invalid meeting ID");
    }
    //validate other fields

    const meetings = await meetingsCollection();
    const updatedMeeting = {};

    // only update the fields that have been provided as input
    if (title) updatedMeeting.title = title;
    if (dateAddedTo) updatedMeeting.dateAddedTo = dateAddedTo;
    if (dateDueOn) updatedMeeting.dateDueOn = dateDueOn;
    if (priority) updatedMeeting.priority = priority;
    if (textBody) updatedMeeting.textBody = textBody;
    if (tag) updatedMeeting.tag = tag;

    const result = await meetings.updateOne(
      { _id: new ObjectId(meetingId) },
      { $set: updatedMeeting }
    );

    // if the meeting was successfully updated, return the updated meeting
    if (result.modifiedCount === 1) {
      const updatedMeeting = await meetings.findOne({
        _id: new ObjectId(meetingId),
      });
      return updatedMeeting;
    } else {
      throw new Error("Meeting not found");
    }
  },
  delete(meetingId) {},

  // userId needed

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
   * @param {number} repeatingCounterIncrement how many times
   * @param {string} repeatingIncrementBy mode of repeating "day" "month" or "year"
   */
  async create(
    userId,
    title,
    dateAddedTo,
    dateDueOn,
    // duration,
    priority,
    textBody,
    tag,
    repeating,
    repeatingCounterIncrement,
    repeatingIncrementBy
  ) {
    if (!utils.checkObjectIdString(userId)) {
      throw new Error("Invalid user id.");
    }
    const isValid = utils.validateMeetingInputs(
      title,
      dateAddedTo,
      dateDueOn,
      //   duration,
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

    const users = await usersCollection();
    const user = await users.findOne({ _id: ObjectId(userId) });
    if (!user) {
      throw new Error("User not found.");
    }

    const meetings = await meetingsCollection();
    if (!repeating) {
      const result = await meetings.insertOne({
        title,
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
      });
      const insertedId = result.insertedId;
      await users.updateOne(
        { _id: ObjectId(userId) },
        { $push: { meetingIds: insertedId } }
      );
      return insertedId;
    } else {
      const repeatingGroup = new ObjectId();
      const meetingObjects = [];

      for (let i = 0; i < repeatingCounterIncrement; i++) {
        let newDateDueOn;
        let newDateAddedTo;
        switch (repeatingIncrementBy) {
          case "day":
            newDateDueOn = new Date(dateDueOn.setDate(dateDueOn.getDate() + 1));
            newDateAddedTo = new Date(
              dateAddedTo.setDate(dateAddedTo.getDate() + 1)
            );
            break;
          case "week":
            newDateDueOn = new Date(dateDueOn.setDate(dateDueOn.getDate() + 7));
            newDateAddedTo = new Date(
              dateAddedTo.setDate(dateAddedTo.getDate() + 7)
            );
            break;
          case "month":
            newDateDueOn = new Date(
              dateDueOn.setMonth(dateDueOn.getMonth() + 1)
            );
            newDateAddedTo = new Date(
              dateAddedTo.setMonth(dateAddedTo.getMonth() + 1)
            );
            break;
          case "year":
            newDateDueOn = new Date(
              dateDueOn.setFullYear(dateDueOn.getFullYear() + 1)
            );
            newDateAddedTo = new Date(
              dateAddedTo.setFullYear(dateAddedTo.getFullYear() + 1)
            );
            break;
          default:
            throw new Error("Invalid repeatingIncrementBy value");
        }

        const meeting = {
          title,
          dateAddedTo: newDateAddedTo,
          dateDueOn: newDateDueOn,
          priority,
          textBody,
          tag,
          repeating,
          repeatingCounterIncrement,
          repeatingIncrementBy,
          repeatingGroup,
          expired: false,
        };
        meetingObjects.push(meeting);
        dateDueOn = newDateDueOn;
        dateAddedTo = newDateAddedTo;
      }

      const result = await meetings.insertMany(meetingObjects);
      const insertedIds = result.insertedIds;
      await users.updateOne(
        { _id: ObjectId(userId) },
        { $push: { meetings: { $each: insertedIds } } }
      );
      return insertedIds;
    }
  },
  //TODO
  getAll(userId) {},

  updateAllRecurrences(
    userId,
    title,
    dateCreated,
    dateAddedTo,
    dateDueOn,
    duration,
    priority,
    textBody,
    tag,
    repeatingGroup
  ) {},
  deleteAllRecurrences(userId, repeatingGroup) {},
};
export default meetingsDataFunctions;
