/*
 * Knowage, Open Source Business Intelligence suite
 * Copyright (C) 2016 Engineering Ingegneria Informatica S.p.A.

 * Knowage is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * Knowage is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.

 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
package it.eng.spagobi.api.v2;

import static java.util.stream.Collectors.toList;

import java.io.IOException;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Predicate;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;

import org.apache.log4j.Logger;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONObjectDeserializator;
import org.quartz.JobDetail;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.impl.StdSchedulerFactory;

import edu.emory.mathcs.backport.java.util.Collections;
import it.eng.spagobi.api.v2.export.Entry;
import it.eng.spagobi.api.v2.export.ExportJobBuilder;
import it.eng.spagobi.api.v2.export.ExportMetadata;
import it.eng.spagobi.api.v2.export.ExportPathBuilder;
import it.eng.spagobi.commons.bo.UserProfile;
import it.eng.spagobi.commons.utilities.SpagoBIUtilities;
import it.eng.spagobi.tools.dataset.constants.DataSetConstants;
import it.eng.spagobi.tools.dataset.service.ManageDataSetsForREST;
import it.eng.spagobi.user.UserProfileManager;

/**
 * Manage entity exported to file.
 *
 * @author Marco Libanori
 */
@Path("/2.0/export")
public class ExportResource {

	private static final Logger logger = Logger.getLogger(ExportResource.class);

	@Context
	protected HttpServletRequest request;

	@Context
	protected HttpServletResponse response;

	/**
	 * Filter a {@link Path} and select only directory.
	 *
	 * TODO : Refactoring when Java 8 will be introduced
	 */
	private static final Predicate<java.nio.file.Path> byDirectoryType = new Predicate<java.nio.file.Path>() {

		@Override
		public boolean test(java.nio.file.Path t) {
			return Files.isDirectory(t);
		}
	};

	/**
	 * Filter a {@link Path} and select only directory.
	 *
	 * TODO : Refactoring when Java 8 will be introduced
	 */
	private static final Predicate<java.nio.file.Path> byNotAlreadyDownloaded = new Predicate<java.nio.file.Path>() {

		@Override
		public boolean test(java.nio.file.Path t) {
			return !Files.isRegularFile(t.resolve(ExportPathBuilder.DOWNLOADED_PLACEHOLDER_FILENAME));
		}
	};

	/**
	 * Filter a {@link Path} and select only directory with 1 file in it.
	 *
	 * TODO : Refactoring when Java 8 will be introduced
	 */
	private static final Predicate<java.nio.file.Path> byDataPresent = new Predicate<java.nio.file.Path>() {

		@Override
		public boolean test(java.nio.file.Path t) {
			return Files.isRegularFile(t.resolve(ExportPathBuilder.DATA_FILENAME));
		}
	};

	/**
	 * Filter a {@link Path} and select only directory with 1 file in it.
	 *
	 * TODO : Refactoring when Java 8 will be introduced
	 */
	private static final Predicate<java.nio.file.Path> byMetadataPresent = new Predicate<java.nio.file.Path>() {

		@Override
		public boolean test(java.nio.file.Path t) {
			return Files.isRegularFile(t.resolve(ExportPathBuilder.METADATA_FILENAME));
		}
	};

	/**
	 * Map a {@link Path} and to the only file contained.
	 *
	 * TODO : Refactoring when Java 8 will be introduced
	 */
	private static final Function<java.nio.file.Path, java.nio.file.Path> toMetadataFileInDirectory = new Function<java.nio.file.Path, java.nio.file.Path>() {

		@Override
		public java.nio.file.Path apply(java.nio.file.Path t) {
			return t.resolve(ExportPathBuilder.METADATA_FILENAME);
		}
	};

	/**
	 * Map a {@link Path} to an {@link Entry}.
	 *
	 * TODO : Refactoring when Java 8 will be introduced
	 */
	private static final Function<java.nio.file.Path, Entry> toEntryForREST = new Function<java.nio.file.Path, Entry>() {

		@Override
		public Entry apply(java.nio.file.Path t) {
			try {
				ExportMetadata metadata = ExportMetadata.readFromJsonFile(t);

				return new Entry(metadata.getDataSetName(), metadata.getStartDate(), metadata.getId().toString());
			} catch (IOException e) {
				logger.error("Error mapping %s to an entry for REST output", e);
				throw new IllegalArgumentException("Error creating REST response", e);
			}
		}
	};

	/**
	 * List all exported files of a specific user.
	 *
	 * An {@link Entry} is generated by any file that is the only file in the path:
	 *
	 * <pre>
	 * ${TOMCAT_HOME}\resources\${TENANT}\export\${USER_ID}\${JOB_UUID}
	 * </pre>
	 *
	 * In every other case the file will be ignored.
	 *
	 * @return List of {@link Entry} with files exported by logged user
	 * @throws IOException In case of errors during access of the filesystem
	 */
	@GET
	@Path("/dataset")
	@Produces(MediaType.APPLICATION_JSON)
	public List<Entry> dataset() throws IOException {

		logger.debug("IN");

		UserProfile userProfile = UserProfileManager.getProfile();
		String resoursePath = SpagoBIUtilities.getResourcePath();
		java.nio.file.Path perUserExportResourcePath = ExportPathBuilder.getInstance().getPerUserExportResourcePath(resoursePath, userProfile);

		List ret = Collections.emptyList();
		if (Files.isDirectory(perUserExportResourcePath)) {

			ret = Files.list(perUserExportResourcePath).filter(byDirectoryType).filter(byNotAlreadyDownloaded).filter(byMetadataPresent).filter(byDataPresent)
					.map(toMetadataFileInDirectory).map(toEntryForREST).collect(toList());
		}

		logger.debug("OUT");

		return ret;
	}

	/**
	 * Schedules an export in CSV format of the dataset in input.
	 *
	 * @param dataSetId   Id of the dataset to be exported
	 * @param driversJson JSON data of drivers
	 * @param paramsJson  JSON data of parameters
	 * @return The job id
	 */
	@POST
	@Path("/dataset/{dataSetId}/csv")
	@Produces(MediaType.TEXT_PLAIN)
	public Response datasetAsCsv(@PathParam("dataSetId") Integer dataSetId, @QueryParam("DRIVERS") JSONObject driversJson,
			@QueryParam("PARAMETERS") JSONObject paramsJson) {

		logger.debug("IN");

		Response ret = null;
		Locale locale = request.getLocale();
		UserProfile userProfile = UserProfileManager.getProfile();
		Map<String, String> params = manageDataSetParameters(paramsJson);
		Map<String, Object> drivers = manageDataSetDrivers(driversJson);

		try {
			Scheduler scheduler = StdSchedulerFactory.getDefaultScheduler();

			JobDetail exportJob = ExportJobBuilder.fromDataSetIdAndUserProfile(dataSetId, userProfile).withTypeOfCsv().withDrivers(drivers)
					.withParameters(params).withLocale(locale).build();

			scheduler.addJob(exportJob, false);
			scheduler.triggerJob(exportJob.getName(), exportJob.getGroup());

			ret = Response.ok().entity(exportJob.getName()).build();

		} catch (SchedulerException e) {
			String msg = String.format("Error during scheduling of export job for dataset %d", dataSetId);
			logger.error(msg, e);
			ret = Response.serverError().build();
		}

		logger.debug("OUT");

		return ret;
	}

	/**
	 * Schedules an export in Excel format of the dataset in input.
	 *
	 * @param dataSetId   Id of the dataset to be exported
	 * @param driversJson JSON data of drivers
	 * @param paramsJson  JSON data of parameters
	 * @return The job id
	 */
	@POST
	@Path("/dataset/{dataSetId}/xls")
	@Produces(MediaType.TEXT_PLAIN)
	public Response datasetAsXls(@PathParam("dataSetId") Integer dataSetId, @QueryParam("DRIVERS") JSONObject driversJson,
			@QueryParam("PARAMETERS") JSONObject paramsJson) {

		logger.debug("IN");

		Response ret = null;
		Locale locale = request.getLocale();
		UserProfile userProfile = UserProfileManager.getProfile();
		Map<String, String> params = manageDataSetParameters(paramsJson);
		Map<String, Object> drivers = manageDataSetDrivers(driversJson);

		try {
			Scheduler scheduler = StdSchedulerFactory.getDefaultScheduler();

			JobDetail exportJob = ExportJobBuilder.fromDataSetIdAndUserProfile(dataSetId, userProfile).withTypeOfXls().withDrivers(drivers)
					.withParameters(params).withLocale(locale).build();

			scheduler.addJob(exportJob, false);
			scheduler.triggerJob(exportJob.getName(), exportJob.getGroup());

			ret = Response.ok().entity(exportJob.getName()).build();

		} catch (SchedulerException e) {
			String msg = String.format("Error during scheduling of export job for dataset %d", dataSetId);
			logger.error(msg, e);
			ret = Response.serverError().build();
		}

		logger.debug("OUT");

		return ret;
	}

	@GET
	@Path("/dataset/{id}")
	public Response get(@PathParam("id") UUID id) throws IOException {

		logger.debug("IN");

		Response ret = Response.status(Status.NOT_FOUND).build();

		ExportPathBuilder exportPathBuilder = ExportPathBuilder.getInstance();

		UserProfile userProfile = UserProfileManager.getProfile();
		String resoursePath = SpagoBIUtilities.getResourcePath();
		java.nio.file.Path dataFile = exportPathBuilder.getPerJobIdDataFile(resoursePath, userProfile, id);

		if (Files.isRegularFile(dataFile)) {
			java.nio.file.Path metadataFile = exportPathBuilder.getPerJobIdMetadataFile(resoursePath, userProfile, id);

			ExportMetadata metadata = ExportMetadata.readFromJsonFile(metadataFile);

			response.setHeader("Content-Disposition", "attachment" + "; filename=\"" + metadata.getFileName() + "\";");

			// Create a placeholder to indicate the file is downloaded
			try {
				Files.createFile(exportPathBuilder.getPerJobIdDownloadedPlaceholderFile(resoursePath, userProfile, id));
			} catch (Exception e) {
				// Yes, it's mute!
			}

			ret = Response.ok(dataFile.toFile()).type(metadata.getMimeType()).build();
		}

		logger.debug("OUT");

		return ret;
	}

	/**
	 * Manage drivers selected at client side.
	 *
	 * @param driversJson JSON data of drivers
	 */
	private Map<String, Object> manageDataSetDrivers(JSONObject driversJson) {

		Map<String, Object> ret = null;

		try {
			ret = JSONObjectDeserializator.getHashMapFromJSONObject(driversJson);
		} catch (Exception e) {
			logger.debug("Cannot read dataset drivers");
			throw new IllegalStateException("Cannot read drivers");
		}

		return ret;
	}

	/**
	 * Manage parameters selected at client side.
	 *
	 * @param paramsJson JSON data of drivers
	 */
	private Map<String, String> manageDataSetParameters(JSONObject paramsJson) {

		Map<String, String> ret = new HashMap<>();

		if (paramsJson != null) {
			try {
				JSONArray paramsJsonArray = paramsJson.getJSONArray("parameters");
				JSONObject pars = new JSONObject();
				pars.put(DataSetConstants.PARS, paramsJsonArray);
				ManageDataSetsForREST mdsr = new ManageDataSetsForREST();
				ret = mdsr.getDataSetParametersAsMap(pars);

			} catch (Exception e) {
				logger.debug("Cannot read dataset parameters");
				throw new IllegalStateException("Cannot read dataset parameters");
			}
		}

		return ret;
	}
}